import { ListChecks } from "lucide-react";

function fmt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function SummaryPanel({ summary }) {
    if (!summary) return null;
    const numericStats = Object.entries(summary.numeric_stats || {});
    const topCategorical = Object.entries(summary.top_categorical || {});

    if (numericStats.length === 0 && topCategorical.length === 0 && !summary.date_range) {
        return null;
    }

    return (
        <div
            className="rounded-2xl border border-zinc-200 bg-[#FFF8E1] p-6 sm:p-7 tactile-shadow"
            data-testid="summary-panel"
        >
            <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-zinc-900" />
                <h2 className="font-heading text-xl font-bold text-zinc-900">Quick Stats</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
                No AI needed — computed straight from your data.
            </p>

            {summary.date_range && (
                <p className="mt-4 text-sm text-zinc-800">
                    <span className="font-semibold">{summary.date_range.column}</span> spans{" "}
                    {summary.date_range.start?.slice(0, 10)} to {summary.date_range.end?.slice(0, 10)}.
                </p>
            )}

            {numericStats.length > 0 && (
                <div className="mt-4 space-y-3">
                    {numericStats.slice(0, 5).map(([col, s]) => (
                        <div key={col} className="rounded-xl bg-white/80 p-3">
                            <p className="text-sm font-semibold text-zinc-900">{col}</p>
                            <div className="mt-1.5 grid grid-cols-4 gap-2 text-center text-xs text-zinc-600">
                                <div>
                                    <p className="font-semibold text-zinc-900">{fmt(s.sum)}</p>
                                    <p>total</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-zinc-900">{fmt(s.mean)}</p>
                                    <p>avg</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-zinc-900">{fmt(s.min)}</p>
                                    <p>min</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-zinc-900">{fmt(s.max)}</p>
                                    <p>max</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {topCategorical.length > 0 && (
                <div className="mt-4 space-y-3">
                    {topCategorical.slice(0, 2).map(([col, counts]) => (
                        <div key={col} className="rounded-xl bg-white/80 p-3">
                            <p className="text-sm font-semibold text-zinc-900">Most common in {col}</p>
                            <ul className="mt-1.5 space-y-1 text-xs text-zinc-700">
                                {Object.entries(counts).slice(0, 4).map(([k, v]) => (
                                    <li key={k} className="flex items-center justify-between">
                                        <span className="truncate pr-2">{k}</span>
                                        <span className="font-semibold text-zinc-900">{v}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
