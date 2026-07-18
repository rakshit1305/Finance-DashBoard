import React, { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import {
    Award,
    BarChart3,
    Download,
    FileText,
    Presentation,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import Dropzone from "../components/Dropzone";
import Sidebar from "../components/Sidebar";
import ChartsPanel from "../components/ChartsPanel";
import InsightsPanel from "../components/InsightsPanel";
import SummaryPanel from "../components/SummaryPanel";
import Leaderboard from "../components/Leaderboard";
import QAChat from "../components/QAChat";
import DataPreview from "../components/DataPreview";
import { Button } from "../components/ui/button";
import { exportUrl, fetchConfig, uploadDatasets } from "../lib/api";

const LOAD_MESSAGES = [
    "Reading your files...",
    "Cleaning columns...",
    "Detecting data types...",
    "Building charts...",
];

export default function Dashboard() {
    const [dataset, setDataset] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loadStep, setLoadStep] = useState(0);
    const [aiConfigured, setAiConfigured] = useState(false);

    useEffect(() => {
        fetchConfig()
            .then((c) => setAiConfigured(!!c.ai_configured))
            .catch(() => setAiConfigured(false));
    }, []);

    const handleFiles = async (files) => {
        setUploading(true);
        setLoadStep(0);
        const iv = setInterval(
            () => setLoadStep((s) => (s + 1) % LOAD_MESSAGES.length),
            900,
        );
        try {
            const data = await uploadDatasets(files);
            setDataset(data);
            toast.success(`Loaded ${data.row_count.toLocaleString()} rows`);
        } catch (e) {
            toast.error(
                e?.response?.data?.detail || e.message || "Upload failed",
            );
        } finally {
            clearInterval(iv);
            setUploading(false);
        }
    };

    const download = (fmt) => {
        if (!dataset) return;
        const url = exportUrl(dataset.id, fmt);
        window.open(url, "_blank");
    };

    return (
        <div className="flex min-h-screen bg-[#F7F8FA]">
            <Toaster richColors position="top-center" />
            <Sidebar dataset={dataset} />

            <div className="flex-1 min-w-0">
                {/* Top bar */}
                <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="lg:hidden flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                            <h1 className="font-heading text-lg font-bold text-zinc-900">Insight Studio</h1>
                        </div>
                        <p className="hidden lg:block text-sm text-zinc-500">
                            {dataset ? (dataset.name || "Your dashboard") : "Upload a file to get started"}
                        </p>
                        {dataset && (
                            <div className="flex items-center gap-2">
                                <Dropzone onFiles={handleFiles} disabled={uploading} minimal />
                                <Button
                                    variant="outline"
                                    onClick={() => download("pdf")}
                                    className="rounded-full border-zinc-300"
                                    data-testid="export-pdf-btn"
                                >
                                    <FileText className="mr-2 h-4 w-4" /> PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => download("pptx")}
                                    className="rounded-full border-zinc-300"
                                    data-testid="export-pptx-btn"
                                >
                                    <Presentation className="mr-2 h-4 w-4" /> PPT
                                </Button>
                                <Button
                                    onClick={() => download("xlsx")}
                                    className="rounded-full bg-zinc-900 hover:bg-zinc-800"
                                    data-testid="export-xlsx-btn"
                                >
                                    <Download className="mr-2 h-4 w-4" /> Excel
                                </Button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
                    {!dataset && !uploading && (
                        <section className="mx-auto max-w-3xl">
                            <div className="mb-8 text-center">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E8FF] px-3 py-1 text-xs text-zinc-800">
                                    <Sparkles className="h-3.5 w-3.5" /> Turn spreadsheets into stories
                                </span>
                                <h1 className="font-heading mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900">
                                    Upload your data.
                                    <br />
                                    Get instant insights.
                                </h1>
                                <p className="mt-4 text-zinc-500">
                                    Drop one file or a whole year of monthly Excels. We'll clean,
                                    chart, and explain - in plain English.
                                </p>
                            </div>
                            <Dropzone onFiles={handleFiles} disabled={uploading} />
                            {!aiConfigured && (
                                <p className="mt-4 text-center text-xs text-zinc-500" data-testid="ai-warning">
                                    {"\ud83d\udca1"} AI insights & Q&A are disabled - add <code className="rounded bg-zinc-100 px-1">OPENAI_API_KEY</code> in{" "}
                                    <code className="rounded bg-zinc-100 px-1">backend/.env</code> to unlock.
                                </p>
                            )}
                        </section>
                    )}

                    {uploading && (
                        <section className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-10 text-center tactile-shadow" data-testid="loading-panel">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3E8FF]">
                                <Sparkles className="h-6 w-6 text-zinc-900 animate-pulse" />
                            </div>
                            <p className="font-heading mt-5 text-lg font-semibold text-zinc-900">
                                {LOAD_MESSAGES[loadStep]}
                            </p>
                            <div className="mt-3 flex justify-center">
                                <span className="loading-dot" />
                                <span className="loading-dot" />
                                <span className="loading-dot" />
                            </div>
                        </section>
                    )}

                    {dataset && !uploading && (
                        <div className="space-y-12" data-testid="dashboard">
                            {/* Overview: KPI row */}
                            <section id="overview" className="scroll-mt-24">
                                <SectionHeading eyebrow="01 — Overview" title="Where things stand" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                    <BusinessKpiRow business={dataset.summary?.business} dataset={dataset} />
                                </div>
                            </section>

                            {/* Trends & breakdown */}
                            <section id="trends" className="scroll-mt-24">
                                <SectionHeading eyebrow="02 — Trends & Breakdown" title="How it moves and splits" />
                                <ChartsPanel charts={dataset.charts} />
                            </section>

                            {/* Top & bottom performers + AI insights */}
                            <section id="performers" className="scroll-mt-24">
                                <SectionHeading eyebrow="03 — Top & Bottom" title="Who's driving it" />
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                    <Leaderboard business={dataset.summary?.business} />
                                    <div className="space-y-6">
                                        <InsightsPanel datasetId={dataset.id} aiConfigured={aiConfigured} />
                                        <SummaryPanel summary={dataset.summary} />
                                    </div>
                                </div>
                            </section>

                            {/* Data & export */}
                            <section id="data" className="scroll-mt-24">
                                <SectionHeading eyebrow="04 — Data & Export" title="The raw numbers, and asking your own questions" />
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                    <DataPreview
                                        schema={dataset.schema}
                                        preview={dataset.preview}
                                        rowCount={dataset.row_count}
                                    />
                                    <QAChat datasetId={dataset.id} aiConfigured={aiConfigured} />
                                </div>
                            </section>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function SectionHeading({ eyebrow, title }) {
    return (
        <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">{eyebrow}</p>
            <h2 className="font-heading mt-1 text-xl sm:text-2xl font-bold text-zinc-900">{title}</h2>
        </div>
    );
}

function formatMoney(v, unitHint) {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    let out;
    if (abs >= 1e7) out = `${sign}${(abs / 1e7).toFixed(2)}Cr`;
    else if (abs >= 1e5) out = `${sign}${(abs / 1e5).toFixed(2)}L`;
    else if (abs >= 1000) out = `${sign}${(abs / 1000).toFixed(1)}K`;
    else out = `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
    return unitHint ? `${out} ${unitHint}` : out;
}

function extractUnit(colName) {
    if (!colName) return "";
    const m = colName.match(/\(([^)]+)\)/);
    return m ? m[1] : "";
}

function BusinessKpiRow({ business, dataset }) {
    // Generic fallback for datasets that don't look like a P&L / sales export
    if (!business?.available) {
        return (
            <>
                <KpiCard label="Rows" value={dataset.row_count?.toLocaleString()} tone="mint" icon={BarChart3} />
                <KpiCard label="Columns" value={dataset.column_count} tone="peach" icon={BarChart3} />
                <KpiCard label="Detected charts" value={dataset.charts?.length ?? 0} tone="butter" icon={BarChart3} />
            </>
        );
    }

    const unit = extractUnit(business.revenue_col || business.profit_col);
    const profitPositive = (business.total_profit ?? 0) >= 0;
    const growthPositive = (business.mom_growth_pct ?? 0) >= 0;
    const topName = business.top_performers?.[0]?.name;
    const revenueLabel = business.revenue_label || "Total Revenue";
    const profitLabel = business.profit_label || (profitPositive ? "Total Profit" : "Total Loss");

    return (
        <>
            {business.total_revenue !== null && (
                <KpiCard
                    label={revenueLabel}
                    value={formatMoney(business.total_revenue, unit)}
                    tone="mint"
                    icon={Wallet}
                />
            )}
            {business.total_profit !== null && (
                <KpiCard
                    label={profitLabel}
                    value={formatMoney(business.total_profit, unit)}
                    tone={profitPositive ? "mint" : "peach"}
                    icon={profitPositive ? TrendingUp : TrendingDown}
                    valueClass={profitPositive ? "text-emerald-700" : "text-rose-700"}
                />
            )}
            {business.profit_margin_pct !== null && (
                <KpiCard
                    label="Profit Margin"
                    value={`${business.profit_margin_pct >= 0 ? "" : "-"}${Math.abs(business.profit_margin_pct).toFixed(1)}%`}
                    tone="purple"
                    icon={profitPositive ? TrendingUp : TrendingDown}
                    valueClass={profitPositive ? "text-emerald-700" : "text-rose-700"}
                    sub={
                        business.mom_growth_pct !== null
                            ? `${growthPositive ? "+" : ""}${business.mom_growth_pct.toFixed(1)}% vs last month`
                            : undefined
                    }
                />
            )}
            {topName && (
                <KpiCard label="Top Performer" value={topName} tone="butter" icon={Award} small />
            )}
        </>
    );
}

function KpiCard({ label, value, tone, icon: Icon, valueClass, sub, small }) {
    const styles = {
        mint: "bg-gradient-to-br from-emerald-50 to-emerald-100/70 border-emerald-100",
        peach: "bg-gradient-to-br from-rose-50 to-rose-100/70 border-rose-100",
        purple: "bg-gradient-to-br from-violet-50 to-violet-100/70 border-violet-100",
        butter: "bg-gradient-to-br from-amber-50 to-amber-100/70 border-amber-100",
    };
    return (
        <div
            className={`rounded-2xl border ${styles[tone] || styles.butter} p-5 tactile-shadow`}
            data-testid={`kpi-${String(label).toLowerCase().replace(/\s+/g, "-")}`}
        >
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p>
                {Icon && <Icon className="h-4 w-4 text-zinc-500" />}
            </div>
            <p
                className={`font-heading mt-2 tracking-tighter text-zinc-900 ${
                    small ? "text-lg sm:text-xl font-bold truncate" : "text-2xl sm:text-3xl font-extrabold"
                } ${valueClass || ""}`}
                title={typeof value === "string" ? value : undefined}
            >
                {value}
            </p>
            {sub && <p className="mt-1 text-xs font-medium text-zinc-500">{sub}</p>}
        </div>
    );
}
