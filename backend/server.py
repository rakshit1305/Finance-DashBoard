"""FastAPI backend for the Data Insights Dashboard.
Endpoints:
    POST /api/datasets/upload   - upload one or more CSV/XLSX files -> dataset
    GET  /api/datasets/{id}     - get preview + schema + charts
    GET  /api/datasets/{id}/insights - AI-generated plain-English insights
    POST /api/datasets/{id}/query    - ask a natural-language question
    GET  /api/datasets/{id}/export/{fmt}  - pdf | pptx | xlsx download
"""
from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from analysis import (
    answer_question_locally,
    build_charts,
    build_custom_chart,
    clean_dataframe,
    concat_files,
    dataset_summary,
    infer_schema,
    preview_rows,
    read_file,
)
from ai_service import answer_question, generate_insights, is_configured
from exports import build_pdf, build_pptx, build_xlsx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / "a.env")

# In-memory dataset metadata store (filename, row/col counts, upload time).
# This app is a single-process local tool, so no external database is
# needed — metadata just needs to survive for the life of the running
# server, and the actual dataframes are cached on disk as parquet below.
DATASET_META: dict[str, dict[str, Any]] = {}

# On-disk parquet cache for dataframes (keeps memory low, faster than JSON)
CACHE_DIR = ROOT_DIR / "_datasets"
CACHE_DIR.mkdir(exist_ok=True)


def _cache_path(dataset_id: str) -> Path:
    return CACHE_DIR / f"{dataset_id}.parquet"


def _load_df(dataset_id: str) -> pd.DataFrame:
    p = _cache_path(dataset_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Dataset not found or expired")
    return pd.read_parquet(p)


app = FastAPI(title="Data Insights Dashboard")
api = APIRouter(prefix="/api")


class QueryRequest(BaseModel):
    question: str


@api.get("/")
async def root():
    return {"ok": True, "service": "data-insights-dashboard"}


@api.get("/config")
async def config():
    """Report whether the LLM key is configured (used by frontend to hide/show AI features)."""
    return {"ai_configured": is_configured(), "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini")}


@api.post("/datasets/upload")
async def upload_datasets(files: list[UploadFile] = File(...)):
    """Accept one or many CSV/XLSX files, merge them, clean, and persist."""
    if not files:
        raise HTTPException(400, "No files provided")
    frames = []
    names = []
    for f in files:
        raw = await f.read()
        if not raw:
            continue
        try:
            df_part = read_file(f.filename or "upload.csv", raw)
        except Exception as e:
            raise HTTPException(400, f"Failed to parse {f.filename}: {e}")
        frames.append(df_part)
        names.append(f.filename)
    if not frames:
        raise HTTPException(400, "Uploaded files were empty")

    df = concat_files(frames)
    df = clean_dataframe(df)
    if df.empty:
        raise HTTPException(400, "No usable data after cleaning")

    dataset_id = str(uuid.uuid4())
    df.to_parquet(_cache_path(dataset_id), index=False)

    schema = infer_schema(df)
    preview = preview_rows(df)
    charts = build_charts(df)
    summary = dataset_summary(df)

    meta = {
        "id": dataset_id,
        "name": ", ".join(names)[:200],
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    DATASET_META[dataset_id] = meta
    return {
        **meta,
        "schema": schema,
        "preview": preview,
        "charts": charts,
        "summary": summary,
    }


@api.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str):
    df = _load_df(dataset_id)
    return {
        "id": dataset_id,
        "schema": infer_schema(df),
        "preview": preview_rows(df),
        "charts": build_charts(df),
        "summary": dataset_summary(df),
    }


@api.get("/datasets/{dataset_id}/insights")
async def dataset_insights(dataset_id: str):
    df = _load_df(dataset_id)
    if not is_configured():
        raise HTTPException(400, "OpenAI API key not configured. Add OPENAI_API_KEY in backend/.env and restart the backend.")
    summary = dataset_summary(df)
    charts = build_charts(df)
    try:
        insights = generate_insights(summary, charts)
    except Exception as e:
        raise HTTPException(500, f"AI insights failed: {e}")
    return {"insights": insights}


@api.post("/datasets/{dataset_id}/query")
async def dataset_query(dataset_id: str, req: QueryRequest):
    df = _load_df(dataset_id)
    if not is_configured():
        raise HTTPException(400, "OpenAI API key not configured. Add OPENAI_API_KEY in backend/.env and restart the backend.")
    summary = dataset_summary(df)
    schema = infer_schema(df)
    local_hint = answer_question_locally(df, req.question)
    try:
        result = answer_question(summary, req.question, schema, local_hint)
    except Exception as e:
        raise HTTPException(500, f"AI query failed: {e}")

    # Prefer a chart the AI explicitly asked for (built from the real
    # dataframe, never invented); fall back to the local heuristic's chart.
    chart = None
    chart_request = result.get("chart_request")
    if chart_request:
        chart = build_custom_chart(
            df,
            chart_type=chart_request.get("type"),
            x_column=chart_request.get("x_column"),
            y_column=chart_request.get("y_column"),
            agg=chart_request.get("agg", "sum"),
        )
    if chart is None:
        chart = (local_hint or {}).get("chart")

    return {"answer": result["answer"], "chart": chart}


@api.get("/datasets/{dataset_id}/export/{fmt}")
async def export_dataset(dataset_id: str, fmt: str):
    if fmt not in {"pdf", "pptx", "xlsx"}:
        raise HTTPException(400, "Unsupported format")
    df = _load_df(dataset_id)
    summary = dataset_summary(df)
    charts = build_charts(df)
    preview = preview_rows(df)

    # Attempt to include AI insights if key is set; otherwise fall back to auto-summary
    insights: list[str]
    if is_configured():
        try:
            insights = generate_insights(summary, charts)
        except Exception:
            insights = _fallback_insights(summary)
    else:
        insights = _fallback_insights(summary)

    meta = DATASET_META.get(dataset_id, {})
    name = meta.get("name", "dataset")

    if fmt == "pdf":
        data = build_pdf(name, summary, insights, charts, preview)
        media = "application/pdf"
        filename = f"report_{dataset_id}.pdf"
    elif fmt == "pptx":
        data = build_pptx(name, summary, insights, charts)
        media = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        filename = f"presentation_{dataset_id}.pptx"
    else:
        data = build_xlsx(df, summary, insights)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"data_{dataset_id}.xlsx"

    return StreamingResponse(io.BytesIO(data), media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
    })


def _fallback_insights(summary: dict[str, Any]) -> list[str]:
    """Simple non-AI summary for when the LLM key isn't configured."""
    out = [
        f"Dataset contains {summary.get('rows', 0):,} rows across {summary.get('columns', 0)} columns.",
    ]
    if summary.get("date_range"):
        dr = summary["date_range"]
        out.append(f"Time range on '{dr['column']}': {dr['start'][:10]} to {dr['end'][:10]}.")
    for col, stats in list(summary.get("numeric_stats", {}).items())[:2]:
        out.append(f"'{col}' - average {stats['mean']:.2f}, min {stats['min']:.2f}, max {stats['max']:.2f}, total {stats['sum']:.2f}.")
    for col, cats in list(summary.get("top_categorical", {}).items())[:1]:
        top = ", ".join(f"{k} ({v})" for k, v in list(cats.items())[:3])
        out.append(f"Most common values in '{col}': {top}.")
    return out


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
@app.get("/")
def home():
    return {"status": "ok", "message": "Backend is live 🚀"}

