"""
Data analysis utilities: parsing, cleaning, chart generation.
Non-technical users upload CSV / XLSX; we clean and produce chart-ready data.
"""
from __future__ import annotations

import io
import math
import re
from typing import Any

import numpy as np
import pandas as pd

MAX_PREVIEW_ROWS = 10
MAX_CATEGORICAL_BUCKETS = 12
HISTOGRAM_BINS = 10
MAX_TIMESERIES_POINTS = 60


def read_file(filename: str, content: bytes) -> pd.DataFrame:
    """Parse a CSV or XLSX file into a pandas DataFrame."""
    name = (filename or "").lower()
    buf = io.BytesIO(content)
    if name.endswith(".csv"):
        return pd.read_csv(buf, low_memory=False)
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return pd.read_excel(buf, engine="openpyxl" if name.endswith(".xlsx") else None)
    # Fallback: try CSV
    return pd.read_csv(buf, low_memory=False)


def _try_parse_dates(series: pd.Series) -> pd.Series | None:
    """Attempt to parse a column as datetime. Return parsed series or None."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return series
    if pd.api.types.is_numeric_dtype(series):
        return None
    non_null = series.dropna()
    if non_null.empty:
        return None
    as_str = series.astype(str)
    threshold = max(3, int(0.6 * len(non_null)))

    # Try common finance-report date formats explicitly first. pandas' 'mixed'
    # format inference can badly misparse short forms like "Apr-25" (reading it
    # as year 1 instead of 2025), so known-good formats take priority.
    for fmt in ("%b-%y", "%b-%Y", "%B-%y", "%B-%Y", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            parsed = pd.to_datetime(as_str, format=fmt, errors="coerce")
        except Exception:
            continue
        if parsed.notna().sum() >= threshold:
            return parsed

    try:
        parsed = pd.to_datetime(as_str, errors="coerce", utc=False, format="mixed")
    except Exception:
        try:
            parsed = pd.to_datetime(as_str, errors="coerce", utc=False)
        except Exception:
            return None
    if parsed.notna().sum() >= threshold:
        # Sanity check: reject parses that land implausible years (a strong
        # signal the 'mixed' inference guessed wrong, as it does for "Apr-25").
        years = parsed.dt.year.dropna()
        if not years.empty and (years.min() < 1970 or years.max() > 2100):
            return None
        return parsed
    return None


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Basic cleaning: strip column names, drop empty rows/cols, parse dates."""
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    df = df.dropna(axis=1, how="all")
    for col in df.columns:
        parsed = _try_parse_dates(df[col])
        if parsed is not None:
            df[col] = parsed
    # Strip string values
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str).str.strip().replace({"nan": np.nan, "None": np.nan, "": np.nan})
    return df


def concat_files(frames: list[pd.DataFrame]) -> pd.DataFrame:
    """Combine multiple monthly uploads into a single dataframe."""
    if not frames:
        return pd.DataFrame()
    if len(frames) == 1:
        return frames[0]
    return pd.concat(frames, ignore_index=True, sort=False)


def _col_type(series: pd.Series) -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    return "categorical"


def infer_schema(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Return list of {name, type, sample} for each column."""
    schema = []
    for col in df.columns:
        s = df[col]
        t = _col_type(s)
        sample = s.dropna().head(3).tolist()
        # JSON-safe
        sample = [str(v) if isinstance(v, (pd.Timestamp,)) else v for v in sample]
        schema.append({"name": col, "type": t, "sample": _to_json_safe(sample), "missing": int(s.isna().sum())})
    return schema


def _to_json_safe(value):
    if isinstance(value, dict):
        return {k: _to_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_json_safe(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        return f if math.isfinite(f) else None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if pd.isna(value) if not isinstance(value, (list, dict)) else False:
        return None
    return value


def preview_rows(df: pd.DataFrame, n: int = MAX_PREVIEW_ROWS) -> list[dict[str, Any]]:
    head = df.head(n).copy()
    # Convert datetimes to strings for JSON
    for col in head.columns:
        if pd.api.types.is_datetime64_any_dtype(head[col]):
            head[col] = head[col].dt.strftime("%Y-%m-%d")
    return _to_json_safe(head.replace({np.nan: None}).to_dict(orient="records"))


REVENUE_KEYWORDS = ["total revenue", "revenue", "turnover", "net sales", "gross sales", "sales",
                    "income", "gmv", "earnings", "billing", "collections"]
PROFIT_KEYWORDS = ["contribution margin", "net profit", "net income", "gross profit", "profit",
                    "margin", "surplus", "pnl", "p&l", "net result"]
COST_KEYWORDS = ["total cost", "cost to serve", "total expense", "cost", "expense", "cogs",
                 "spend", "expenditure", "outflow"]
VOLUME_KEYWORDS = ["units sold", "units", "orders", "quantity", "qty", "transactions",
                   "shipments", "visitors", "count", "headcount"]
# Generic "this is probably an important amount column" fallback keywords, used only when
# nothing above matches at all — much broader, on purpose.
GENERIC_AMOUNT_KEYWORDS = ["amount", "value", "total", "net", "gross", "price", "cost",
                           "budget", "actual", "balance", "fee", "charge", "payment"]
DIMENSION_KEYWORDS = ["brand", "product", "category", "segment", "region", "zone", "customer",
                      "store", "channel", "department", "name", "employee", "vendor", "supplier",
                      "team", "country", "city", "state", "class", "type", "group"]


def _best_numeric_col(df: pd.DataFrame, numeric_cols: list[str], keywords: list[str]) -> str | None:
    """Pick the numeric column that best matches a business concept (e.g. 'revenue'),
    ranked by keyword priority (skipping percentage/rate columns). Ties are broken by
    picking the column with the larger total magnitude, since the real aggregate line
    (e.g. 'Total Platform Revenue') is usually much bigger than a sub-component
    (e.g. 'Commission Revenue')."""
    candidates = []  # (rank, -abs(sum), col)
    for c in numeric_cols:
        if "%" in c:
            continue
        cl = c.lower()
        for rank, kw in enumerate(keywords):
            if kw in cl:
                try:
                    magnitude = abs(df[c].sum())
                except Exception:
                    magnitude = 0
                candidates.append((rank, -magnitude, c))
                break
    if not candidates:
        return None
    candidates.sort(key=lambda x: (x[0], x[1]))
    return candidates[0][2]


ID_NAME_PATTERN = re.compile(r"(^|[\s_])(id|code|no\.?|number|index|uuid|guid)($|[\s_])", re.IGNORECASE)


def _looks_like_id(df: pd.DataFrame, col: str) -> bool:
    """A numeric column that's really a row identifier (named like one, or a plain
    1..n sequence) isn't a meaningful metric to headline. High cardinality alone is
    NOT a valid signal here — genuine amounts (salary, revenue, price) are often
    almost-all-unique too, so we must not exclude those."""
    if ID_NAME_PATTERN.search(col):
        return True
    s = df[col].dropna()
    if len(s) < 5:
        return False
    # Detect a plain sequential index: sorted values are consecutive integers
    try:
        sorted_vals = s.sort_values().to_numpy()
        if np.all(np.diff(sorted_vals) == 1) and float(sorted_vals[0]) in (0, 1):
            return True
    except Exception:
        pass
    return False


def _fallback_metric_col(df: pd.DataFrame, numeric_cols: list[str]) -> str | None:
    """Last-resort metric picker for datasets with no recognizable finance vocabulary at
    all (e.g. non-English headers, or a totally different domain). Prefers columns whose
    name hints at being an aggregate amount, otherwise just picks the numeric column with
    the largest total magnitude, skipping percentages/rates and obvious ID columns."""
    usable = [c for c in numeric_cols if "%" not in c and not _looks_like_id(df, c)]
    if not usable:
        return None
    named = _best_numeric_col(df, usable, GENERIC_AMOUNT_KEYWORDS)
    if named:
        return named
    # Otherwise: the column with the biggest total magnitude is usually the headline metric
    # (row counts / flags tend to be small; the "big number" column is usually the one that matters)
    try:
        return max(usable, key=lambda c: abs(df[c].sum()))
    except Exception:
        return usable[0]


def compute_business_kpis(df: pd.DataFrame) -> dict[str, Any]:
    """Generically detect revenue/profit/cost/volume columns and a primary business
    dimension (brand, product, category, etc.) by column-name heuristics, then compute
    the KPIs and leaderboards a business dashboard actually needs — works on any
    dataset shaped like a P&L / sales export, not just this one."""
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    datetime_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    cat_cols = [c for c in df.columns if _col_type(df[c]) == "categorical"]

    revenue_col = _best_numeric_col(df, numeric_cols, REVENUE_KEYWORDS)
    profit_col = _best_numeric_col(df, numeric_cols, PROFIT_KEYWORDS)
    cost_col = _best_numeric_col(df, numeric_cols, COST_KEYWORDS)
    volume_col = _best_numeric_col(df, numeric_cols, VOLUME_KEYWORDS)

    # If nothing finance-shaped was found at all, fall back to the most meaningful
    # numeric column so the dashboard still shows a real headline number instead of
    # meta stats like row/column counts.
    used_fallback = False
    if not revenue_col and not profit_col:
        fallback = _fallback_metric_col(df, numeric_cols)
        if fallback:
            revenue_col = fallback
            used_fallback = True

    dimension_col = None
    for kw in DIMENSION_KEYWORDS:
        for c in cat_cols:
            if kw in c.lower() and 2 <= df[c].nunique(dropna=True) <= 100:
                dimension_col = c
                break
        if dimension_col:
            break
    if not dimension_col:
        # Any reasonably-sized categorical column works as a grouping dimension
        best_card = None
        for c in cat_cols:
            n = df[c].nunique(dropna=True)
            if 2 <= n <= 60 and (best_card is None or n > best_card[1]):
                best_card = (c, n)
        if best_card:
            dimension_col = best_card[0]

    time_col = datetime_cols[0] if datetime_cols else None

    total_revenue = _to_json_safe(df[revenue_col].sum()) if revenue_col else None
    total_cost = _to_json_safe(df[cost_col].sum()) if cost_col else None
    if profit_col:
        total_profit = _to_json_safe(df[profit_col].sum())
    elif total_revenue is not None and total_cost is not None:
        total_profit = _to_json_safe(total_revenue - total_cost)
    else:
        total_profit = None
    profit_margin_pct = (
        _to_json_safe(total_profit / total_revenue * 100) if total_profit is not None and total_revenue else None
    )
    total_volume = _to_json_safe(df[volume_col].sum()) if volume_col else None

    mom_growth_pct = None
    if time_col and (revenue_col or profit_col):
        target_col = revenue_col or profit_col
        ts = df[[time_col, target_col]].dropna().set_index(time_col).resample("MS")[target_col].sum()
        if len(ts) >= 2 and ts.iloc[-2] not in (0, None) and not pd.isna(ts.iloc[-2]):
            mom_growth_pct = _to_json_safe((ts.iloc[-1] - ts.iloc[-2]) / abs(ts.iloc[-2]) * 100)

    top_performers, bottom_performers = [], []
    profitable_segments = total_segments = None
    if dimension_col and (profit_col or revenue_col):
        rank_col = profit_col or revenue_col
        grp = df.groupby(dimension_col)[rank_col].sum().sort_values(ascending=False)
        total_segments = int(len(grp))
        if profit_col:
            profitable_segments = int((grp > 0).sum())
        top_performers = [{"name": str(k), "value": _to_json_safe(v)} for k, v in grp.head(5).items()]
        if len(grp) > 5:
            bottom_performers = [{"name": str(k), "value": _to_json_safe(v)} for k, v in grp.tail(5).items()][::-1]

    # Human-friendly labels: use "Revenue"/"Profit" language only when we're confident
    # (a real keyword match), otherwise be honest and label with the actual column name.
    revenue_label = "Total Revenue" if (revenue_col and not used_fallback) else (f"Total {revenue_col}" if revenue_col else None)
    profit_label = ("Total Profit" if (total_profit or 0) >= 0 else "Total Loss") if total_profit is not None else None

    return {
        "available": bool(revenue_col or profit_col),
        "used_fallback_metric": used_fallback,
        "revenue_col": revenue_col,
        "profit_col": profit_col,
        "cost_col": cost_col,
        "volume_col": volume_col,
        "dimension_col": dimension_col,
        "time_col": time_col,
        "total_revenue": total_revenue,
        "total_cost": total_cost,
        "total_profit": total_profit,
        "profit_margin_pct": profit_margin_pct,
        "mom_growth_pct": mom_growth_pct,
        "total_volume": total_volume,
        "profitable_segments": profitable_segments,
        "total_segments": total_segments,
        "top_performers": top_performers,
        "bottom_performers": bottom_performers,
        "revenue_label": revenue_label,
        "profit_label": profit_label,
    }


def dataset_summary(df: pd.DataFrame) -> dict[str, Any]:
    """High-level dataset summary used for AI prompts."""
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    datetime_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    cat_cols = [c for c in df.columns if _col_type(df[c]) == "categorical"]

    stats = {}
    for c in numeric_cols:
        s = df[c].dropna()
        if s.empty:
            continue
        stats[c] = {
            "mean": _to_json_safe(s.mean()),
            "min": _to_json_safe(s.min()),
            "max": _to_json_safe(s.max()),
            "sum": _to_json_safe(s.sum()),
            "median": _to_json_safe(s.median()),
        }

    top_cats = {}
    for c in cat_cols[:5]:
        vc = df[c].value_counts().head(5)
        top_cats[c] = {str(k): int(v) for k, v in vc.items()}

    date_range = None
    if datetime_cols:
        c = datetime_cols[0]
        s = df[c].dropna()
        if not s.empty:
            date_range = {"column": c, "start": s.min().isoformat(), "end": s.max().isoformat()}

    return {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "numeric_columns": numeric_cols,
        "datetime_columns": datetime_cols,
        "categorical_columns": cat_cols,
        "numeric_stats": stats,
        "top_categorical": top_cats,
        "date_range": date_range,
        "business": compute_business_kpis(df),
    }


def build_charts(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Auto-generate chart specs from the dataframe. Where the data looks like a
    business/P&L export (revenue, profit, cost, brand/category columns), charts are
    built around those real business metrics instead of an arbitrary numeric column,
    so a Brand/Category/Zone breakdown shows profit or revenue — not just row counts."""
    charts: list[dict[str, Any]] = []
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    datetime_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    cat_cols = [c for c in df.columns if _col_type(df[c]) == "categorical"]

    biz = compute_business_kpis(df)
    primary_metric = biz["profit_col"] or biz["revenue_col"] or (numeric_cols[0] if numeric_cols else None)
    primary_dim = biz["dimension_col"]

    def best_categorical(exclude: str | None = None) -> str | None:
        for c in cat_cols:
            if c == exclude:
                continue
            nunique = df[c].nunique(dropna=True)
            if 2 <= nunique <= 50:
                return c
        return None

    # 1. Line chart: trend of the primary business metric over time (falls back to
    # the first numeric column for non-business datasets).
    if datetime_cols and (primary_metric or numeric_cols):
        dcol = datetime_cols[0]
        ncol = primary_metric or numeric_cols[0]
        ts = df[[dcol, ncol]].dropna().copy()
        if not ts.empty:
            ts = ts.set_index(dcol).resample("MS")[ncol].sum().dropna()
            if len(ts) > MAX_TIMESERIES_POINTS:
                ts = ts.iloc[-MAX_TIMESERIES_POINTS:]
            data = [{"x": idx.strftime("%Y-%m"), "y": _to_json_safe(v)} for idx, v in ts.items()]
            if len(data) >= 2:
                charts.append({
                    "type": "line",
                    "title": f"{ncol} trend over time",
                    "x_label": dcol,
                    "y_label": ncol,
                    "data": data,
                })

    # 2. Bar chart: primary metric by primary dimension (e.g. Contribution Margin by Brand)
    best = primary_dim or best_categorical()
    if best is not None:
        if primary_metric:
            grp = df.groupby(best)[primary_metric].sum().sort_values(ascending=False).head(MAX_CATEGORICAL_BUCKETS)
            data = [{"x": str(k), "y": _to_json_safe(v)} for k, v in grp.items()]
            title = f"{primary_metric} by {best}"
            y_label = primary_metric
        else:
            vc = df[best].value_counts().head(MAX_CATEGORICAL_BUCKETS)
            data = [{"x": str(k), "y": int(v)} for k, v in vc.items()]
            title = f"Count of records by {best}"
            y_label = "count"
        charts.append({
            "type": "bar", "title": title, "x_label": best, "y_label": y_label, "data": data,
            "has_negative": bool(any(d["y"] < 0 for d in data)),
        })

    # 3. Histogram from a numeric column not already used as the primary metric
    # (percentage/rate columns make poor histograms for a business summary, so skip them)
    if numeric_cols:
        used = {c["y_label"] for c in charts}
        candidates = [c for c in numeric_cols if c not in used and "%" not in c]
        target = candidates[0] if candidates else next((c for c in numeric_cols if c not in used), numeric_cols[0] if numeric_cols else None)
        s = df[target].dropna() if target else pd.Series(dtype=float)
        if target and len(s) >= 5:
            counts, edges = np.histogram(s, bins=HISTOGRAM_BINS)
            data = [{"x": f"{edges[i]:.1f}\u2013{edges[i + 1]:.1f}", "y": int(cnt)} for i, cnt in enumerate(counts)]
            charts.append({
                "type": "histogram",
                "title": f"Distribution of {target}",
                "x_label": target,
                "y_label": "frequency",
                "data": data,
            })

    # 4. Pie chart (composition): share of a metric by primary dimension.
    # Pies only make sense for positive quantities. Profit/margin metrics are often
    # negative for loss-making segments, so rather than skip the pie entirely (leaving
    # users with no composition view at all), fall back to a metric that IS all-positive
    # for this same breakdown — revenue/volume — so there's still a share-of-total chart.
    if best is not None:
        pie_metric = None
        pie_grp = None
        for candidate in [primary_metric, biz.get("revenue_col"), biz.get("cost_col"), biz.get("volume_col")]:
            if not candidate or candidate == pie_metric:
                continue
            grp = df.groupby(best)[candidate].sum().sort_values(ascending=False)
            if (grp < 0).sum() == 0 and grp.sum() > 0:
                pie_metric = candidate
                pie_grp = grp
                break
        if pie_grp is None and not primary_metric:
            pie_grp = df[best].value_counts()
            pie_metric = "count"
        if pie_grp is not None:
            top = pie_grp.head(6)
            rest = pie_grp.iloc[6:].sum()
            data = [{"x": str(k), "y": _to_json_safe(v)} for k, v in top.items()]
            if rest and rest > 0:
                data.append({"x": "Other", "y": _to_json_safe(rest)})
            if len(data) >= 2:
                charts.append({
                    "type": "pie",
                    "title": f"Share of {pie_metric} by {best}",
                    "x_label": best,
                    "y_label": pie_metric,
                    "data": data,
                })

    # 5. Secondary breakdown: a second categorical dimension (e.g. Zone/Category when
    # Brand is already the primary one), weighted by the same business metric — this
    # avoids a near-identical, uninformative row-count split across a handful of buckets.
    secondary = best_categorical(exclude=best)
    if secondary is not None and primary_metric:
        grp2 = df.groupby(secondary)[primary_metric].sum().sort_values(ascending=False).head(MAX_CATEGORICAL_BUCKETS)
        data2 = [{"x": str(k), "y": _to_json_safe(v)} for k, v in grp2.items()]
        if len(data2) >= 2:
            charts.append({
                "type": "bar",
                "title": f"{primary_metric} by {secondary}",
                "x_label": secondary,
                "y_label": primary_metric,
                "data": data2,
                "has_negative": bool(any(d["y"] < 0 for d in data2)),
            })

    return charts


def build_custom_chart(
    df: pd.DataFrame,
    chart_type: str,
    x_column: str | None = None,
    y_column: str | None = None,
    agg: str = "sum",
) -> dict[str, Any] | None:
    """Build one chart on demand (e.g. requested via the Q&A chat).
    The chart TYPE/COLUMNS may be chosen by the AI, but every number in the
    returned data comes straight from pandas — never invented by the model.
    Returns None if the request doesn't map to real, usable columns.
    """
    chart_type = (chart_type or "").lower()
    if chart_type not in {"line", "bar", "pie", "histogram"}:
        return None
    if x_column and x_column not in df.columns:
        x_column = None
    if y_column and y_column not in df.columns:
        y_column = None

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    datetime_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]

    # Histogram: needs one numeric column (x_column doubles as the target).
    if chart_type == "histogram":
        target = x_column if x_column in numeric_cols else (y_column if y_column in numeric_cols else None)
        target = target or (numeric_cols[0] if numeric_cols else None)
        if not target:
            return None
        s = df[target].dropna()
        if len(s) < 5:
            return None
        counts, edges = np.histogram(s, bins=HISTOGRAM_BINS)
        data = [
            {"x": f"{edges[i]:.1f}\u2013{edges[i + 1]:.1f}", "y": int(cnt)}
            for i, cnt in enumerate(counts)
        ]
        return {
            "type": "histogram",
            "title": f"Distribution of {target}",
            "x_label": target,
            "y_label": "frequency",
            "data": data,
        }

    # Line: needs a datetime x-axis + numeric y.
    if chart_type == "line":
        xcol = x_column if x_column in datetime_cols else (datetime_cols[0] if datetime_cols else None)
        ycol = y_column if y_column in numeric_cols else (numeric_cols[0] if numeric_cols else None)
        if not xcol or not ycol:
            return None
        ts = df[[xcol, ycol]].dropna().set_index(xcol).resample("MS")[ycol].sum().dropna()
        if len(ts) > MAX_TIMESERIES_POINTS:
            ts = ts.iloc[-MAX_TIMESERIES_POINTS:]
        data = [{"x": idx.strftime("%Y-%m"), "y": _to_json_safe(v)} for idx, v in ts.items()]
        if len(data) < 2:
            return None
        return {
            "type": "line",
            "title": f"{ycol} trend over time",
            "x_label": xcol,
            "y_label": ycol,
            "data": data,
        }

    # Bar / pie: need a categorical-ish x-axis, aggregate a numeric y (or count rows).
    xcol = x_column or next(
        (c for c in df.columns if c not in numeric_cols and c not in datetime_cols and 2 <= df[c].nunique(dropna=True) <= 50),
        None,
    )
    if not xcol:
        return None
    ycol = y_column if y_column in numeric_cols else None
    agg = agg if agg in {"sum", "mean", "count"} else "sum"

    if ycol and agg in {"sum", "mean"}:
        grp = df.groupby(xcol)[ycol].agg(agg).sort_values(ascending=False)
        y_label = f"{agg} of {ycol}"
    else:
        grp = df[xcol].value_counts()
        y_label = "count"

    if chart_type == "pie":
        top = grp.head(6)
        rest = grp.iloc[6:].sum()
        data = [{"x": str(k), "y": _to_json_safe(v)} for k, v in top.items()]
        if rest and rest > 0:
            data.append({"x": "Other", "y": _to_json_safe(rest)})
    else:
        grp = grp.head(MAX_CATEGORICAL_BUCKETS)
        data = [{"x": str(k), "y": _to_json_safe(v)} for k, v in grp.items()]

    if len(data) < 2:
        return None
    result = {
        "type": chart_type,
        "title": f"{y_label} by {xcol}",
        "x_label": xcol,
        "y_label": y_label,
        "data": data,
    }
    if chart_type == "bar":
        result["has_negative"] = bool(any(d["y"] < 0 for d in data))
    return result


def answer_question_locally(df: pd.DataFrame, question: str) -> dict[str, Any] | None:
    """Try to answer common finance-y questions purely via pandas (grounded).
    Returns dict with `answer` and optional `chart`, or None if we can't handle it locally.
    The LLM will use this as a data-grounded hint or write its own answer.
    """
    q = question.lower()
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    if not numeric_cols:
        return None
    # Highest / top expenses
    if any(k in q for k in ["highest", "top", "largest", "biggest"]):
        col = numeric_cols[0]
        # try to find explicit column reference
        for c in numeric_cols:
            if c.lower() in q:
                col = c
                break
        cat_cols = [c for c in df.columns if _col_type(df[c]) == "categorical"]
        if cat_cols:
            grp = df.groupby(cat_cols[0])[col].sum().sort_values(ascending=False).head(5)
            data = [{"x": str(k), "y": _to_json_safe(v)} for k, v in grp.items()]
            return {
                "summary": f"Top 5 {cat_cols[0]} by total {col}",
                "chart": {"type": "bar", "title": f"Top {cat_cols[0]} by {col}", "data": data, "x_label": cat_cols[0], "y_label": col},
            }
    return None