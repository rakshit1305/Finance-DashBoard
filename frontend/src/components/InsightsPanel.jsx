

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { fetchInsights } from "../lib/api";
import { Button } from "../components/ui/button";

const LOADING_STEPS = [
    "Reading rows...",
    "Finding trends...",
    "Spotting anomalies...",
    "Writing insights...",
];

export default function InsightsPanel({ datasetId, aiConfigured }) {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [step, setStep] = useState(0);

    const run = async () => {
        if (!aiConfigured) {
            setError("Add your OpenAI API key to backend/.env (OPENAI_API_KEY) and restart to unlock AI insights.");
            return;
        }
        setLoading(true);
        setError(null);
        setStep(0);
        const iv = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 1200);
        try {
            const items = await fetchInsights(datasetId);
            setInsights(items);
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Failed to fetch insights");
        } finally {
            clearInterval(iv);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (datasetId && aiConfigured) run();
        // eslint-disable-next-line
    }, [datasetId, aiConfigured]);

    return (
        <div
            className="rounded-2xl border border-zinc-200 bg-[#F3E8FF] p-6 sm:p-7 tactile-shadow"
            data-testid="insights-panel"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-zinc-900" />
                    <h2 className="font-heading text-xl font-bold text-zinc-900">AI Insights</h2>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={run}
                    disabled={loading || !aiConfigured}
                    className="rounded-full text-zinc-700 hover:bg-white/60"
                    data-testid="refresh-insights-btn"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {loading && (
                <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-700">
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="ml-2">{LOADING_STEPS[step]}</span>
                    </div>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-4 w-full animate-pulse rounded-full bg-white/70" />
                    ))}
                </div>
            )}

            {!loading && error && (
                <p className="mt-4 rounded-xl bg-white/80 p-3 text-sm text-zinc-700" data-testid="insights-error">
                    {error}
                </p>
            )}

            {!loading && !error && insights.length > 0 && (
                <ul className="mt-5 space-y-3" data-testid="insights-list">
                    {insights.map((text, i) => (
                        <li
                            key={i}
                            className="fade-in-up rounded-xl bg-white p-4 text-sm leading-relaxed text-zinc-800 shadow-sm"
                            style={{ animationDelay: `${i * 80}ms` }}
                        >
                            {text}
                        </li>
                    ))}
                </ul>
            )}

            {!loading && !error && insights.length === 0 && aiConfigured && (
                <p className="mt-4 text-sm text-zinc-600">Click refresh to generate insights.</p>
            )}
        </div>
    );
}

