import { Award, TrendingDown } from "lucide-react";

function formatValue(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)}Cr`;
    if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
    return `${sign}${abs.toFixed(1)}`;
}

function Row({ rank, name, value, maxAbs, positive }) {
    const width = maxAbs ? Math.max(6, (Math.abs(value) / maxAbs) * 100) : 6;
    return (
        <div className="flex items-center gap-3 py-1.5">
            <span className="w-4 shrink-0 text-xs font-semibold text-zinc-400">{rank}</span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-800">{name}</p>
                    <p className={`shrink-0 text-sm font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                        {positive ? "+" : ""}
                        {formatValue(value)}
                    </p>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                        className={`h-full rounded-full ${positive ? "bg-emerald-400" : "bg-rose-400"}`}
                        style={{ width: `${width}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function Leaderboard({ business }) {
    const top = business?.top_performers || [];
    const bottom = business?.bottom_performers || [];
    if (!business?.available || (top.length === 0 && bottom.length === 0)) return null;

    const maxAbs = Math.max(1, ...top.map((t) => Math.abs(t.value)), ...bottom.map((b) => Math.abs(b.value)));
    const dim = business.dimension_col || "segment";
    const rankMetric = business.profit_col || business.revenue_col;
    const isProfitRanking = !!business.profit_col;
    const topLabel = isProfitRanking ? "Most profitable" : `Highest ${rankMetric}`;
    const bottomLabel = isProfitRanking ? "Biggest losses" : `Lowest ${rankMetric}`;

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 tactile-shadow" data-testid="leaderboard-panel">
            <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-zinc-900" />
                <h2 className="font-heading text-xl font-bold text-zinc-900">Top &amp; bottom performers</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
                Ranked by {rankMetric} across each {dim}.
            </p>

            {top.length > 0 && (
                <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        {topLabel}
                    </p>
                    <div className="mt-1">
                        {top.map((t, i) => (
                            <Row key={t.name} rank={i + 1} name={t.name} value={t.value} maxAbs={maxAbs} positive />
                        ))}
                    </div>
                </div>
            )}

            {bottom.length > 0 && (
                <div className="mt-5">
                    <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-rose-700">
                        <TrendingDown className="h-3.5 w-3.5" /> {bottomLabel}
                    </p>
                    <div className="mt-1">
                        {bottom.map((b, i) => (
                            <Row key={b.name} rank={i + 1} name={b.name} value={b.value} maxAbs={maxAbs} positive={false} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
