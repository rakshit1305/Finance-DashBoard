"""LLM-powered insight + Q&A service using OpenAI (gpt-4o-mini by default).
Uses the user's own OpenAI API key from the OPENAI_API_KEY env var.
"""
from __future__ import annotations
import json
import os
from typing import Any
import httpx
from openai import OpenAI
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
def _client() -> OpenAI | None:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    # Pass an explicit httpx.Client so stray HTTP_PROXY/HTTPS_PROXY env vars
    # (or a stale openai/httpx version) can't reintroduce the
    # "unexpected keyword argument 'proxies'" crash.
    return OpenAI(api_key=key, http_client=httpx.Client())
def is_configured() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())
def _chat(system: str, user: str, temperature: float = 0.3) -> str:
    client = _client()
    if client is None:
        raise RuntimeError("OpenAI API key not configured. Add OPENAI_API_KEY to backend/.env")
    resp = client.chat.completions.create(
        model=DEFAULT_MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()
def _chat_json(system: str, user: str, temperature: float = 0.2) -> dict[str, Any]:
    """Like _chat, but forces the model to return a JSON object."""
    client = _client()
    if client is None:
        raise RuntimeError("OpenAI API key not configured. Add OPENAI_API_KEY to backend/.env")
    resp = client.chat.completions.create(
        model=DEFAULT_MODEL,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    raw = (resp.choices[0].message.content or "").strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"answer": raw, "chart_request": None}
def generate_insights(summary: dict[str, Any], charts: list[dict[str, Any]]) -> list[str]:
    """Return 3-6 short plain-English insight bullets."""
    system = (
        "You are a friendly data analyst writing for a non-technical business audience. "
        "Given a dataset summary and auto-generated charts, produce 4-6 short, "
        "concrete insights in plain English. Each insight must be a single sentence, "
        "start with a strong observation, and reference an actual number when possible. "
        "If summary.business is present (revenue, profit, margin, month-over-month growth, "
        "top_performers, bottom_performers), prioritize insights about overall profitability, "
        "which segments (brands/categories/etc.) are driving profit vs loss, and the trend "
        "direction — that's more useful to a business reader than generic column stats. "
        "Avoid jargon. Return a JSON object: {\"insights\": [\"...\", \"...\"]}."
    )
    payload = {"summary": summary, "charts_preview": [{k: v for k, v in c.items() if k != "data"} for c in charts]}
    user = "Dataset:\n" + json.dumps(payload, default=str)[:8000]
    raw = _chat(system, user, temperature=0.4)
    try:
        # Strip code fences if present
        raw_clean = raw.strip().strip("`")
        if raw_clean.lower().startswith("json"):
            raw_clean = raw_clean[4:].strip()
        parsed = json.loads(raw_clean)
        items = parsed.get("insights") or []
        return [str(x).strip() for x in items if str(x).strip()][:6]
    except Exception:
        # Fallback: split by newline / bullet
        lines = [ln.strip("-\u2022 \t") for ln in raw.splitlines() if ln.strip()]
        return lines[:6]
def answer_question(
    summary: dict[str, Any],
    question: str,
    schema: list[dict[str, Any]] | None = None,
    local_hint: dict | None = None,
) -> dict[str, Any]:
    """Answer any question the user asks — using the uploaded dataset when it's
    relevant, and general finance/business knowledge otherwise (like a normal
    finance-savvy assistant, not restricted to only what's in the file).

    Can also request a chart by column name; the caller is responsible for
    actually building that chart from the real dataframe (this function never
    invents numbers — it only proposes what to plot).

    Returns: {"answer": str, "chart_request": {"type","x_column","y_column","agg"} | None}
    """
    columns_desc = ""
    if schema:
        columns_desc = "\nAvailable columns in the dataset: " + ", ".join(
            f"{c['name']} ({c['type']})" for c in schema
        )
    system = (
        "You are a knowledgeable finance assistant, similar to a general-purpose "
        "assistant like ChatGPT, but with direct access to the user's uploaded dataset. "
        "Answer ANY question the user asks:\n"
        "- If it's about their uploaded data, ground your answer in the dataset summary "
        "and pre-computed hint provided below, and cite real numbers from them.\n"
        "- If it's a general finance, investing, accounting, budgeting, or business "
        "question that isn't about their specific file, answer it from your own general "
        "knowledge, exactly like you normally would — don't refuse or deflect just "
        "because it's not in the dataset.\n"
        "- If a question mixes both, answer the general part from knowledge and the "
        "data part from the dataset.\n"
        "Keep answers under 150 words, plain English, no unnecessary hedging.\n\n"
        "If (and only if) the user is asking to see/plot/chart/visualize/graph "
        "something that maps to real columns in the dataset, also propose a chart by "
        "setting chart_request. Only reference column names that literally appear in "
        "the 'Available columns' list — never invent a column name. Leave chart_request "
        "null for anything else, including plain questions.\n\n"
        "Respond ONLY with a JSON object of this exact shape:\n"
        '{"answer": "...", "chart_request": null | '
        '{"type": "line"|"bar"|"pie"|"histogram", "x_column": "..."|null, '
        '"y_column": "..."|null, "agg": "sum"|"mean"|"count"}}'
    )
    parts = ["Dataset summary:", json.dumps(summary, default=str)[:6000] + columns_desc]
    if local_hint:
        parts += ["\nPre-computed hint (grounded in the actual data):", json.dumps(local_hint, default=str)[:2000]]
    parts += ["\nUser question:", question]
    result = _chat_json(system, "\n".join(parts), temperature=0.2)
    answer = str(result.get("answer") or "").strip() or "Sorry, I couldn't come up with an answer to that."
    chart_request = result.get("chart_request") or None
    if chart_request and not isinstance(chart_request, dict):
        chart_request = None
    return {"answer": answer, "chart_request": chart_request}
