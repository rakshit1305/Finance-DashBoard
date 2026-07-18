import { useState, useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { LayoutGrid, Maximize2, Rows3, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const PASTELS = ["#A7D8B7", "#F4B7AE", "#C7B7EF", "#F5DC85", "#9FC5E8", "#F5A97F", "#B8E0D2"];

function ChartBody({ chart, height }) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            {chart.type === "line" ? (
                <LineChart data={chart.data} margin={{ top: 10, right: 16, left: 0, bottom: 12 }}>
                    <CartesianGrid stroke="#F4F4F5" vertical={false} />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7" }} />
                    <Line
                        type="monotone"
                        dataKey="y"
                        stroke="#18181B"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#18181B" }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            ) : chart.type === "pie" ? (
                <PieChart margin={{ top: 10, right: 16, left: 16, bottom: 12 }}>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7" }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#71717A" }} />
                    <Pie
                        data={chart.data}
                        dataKey="y"
                        nameKey="x"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                    >
                        {chart.data.map((entry, i) => (
                            <Cell key={`slice-${i}`} fill={PASTELS[i % PASTELS.length]} />
                        ))}
                    </Pie>
                </PieChart>
            ) : (
                <BarChart data={chart.data} margin={{ top: 10, right: 16, left: 0, bottom: 12 }}>
                    <CartesianGrid stroke="#F4F4F5" vertical={false} />
                    <XAxis
                        dataKey="x"
                        tick={{ fontSize: 11, fill: "#71717A" }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={chart.data.length > 6 ? -25 : 0}
                        textAnchor={chart.data.length > 6 ? "end" : "middle"}
                        height={chart.data.length > 6 ? 60 : 30}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E4E4E7" }} />
                    {chart.has_negative && <ReferenceLine y={0} stroke="#D4D4D8" strokeWidth={1.5} />}
                    <Bar dataKey="y" radius={[6, 6, 0, 0]}>
                        {chart.data.map((entry, i) => (
                            <Cell
                                key={`bar-${i}`}
                                fill={
                                    chart.has_negative
                                        ? entry.y >= 0 ? "#6EE7B7" : "#FCA5A5"
                                        : chart.type === "histogram" ? PASTELS[2] : PASTELS[0]
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            )}
        </ResponsiveContainer>
    );
}

export function ChartCard({ chart, onExpand }) {
    if (!chart || !chart.data?.length) {
        return <p className="text-sm text-zinc-500">No chart data.</p>;
    }
    return (
        <div className="w-full">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-heading text-lg font-semibold text-zinc-900">{chart.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                        {chart.x_label} · {chart.y_label}
                    </p>
                </div>
                {onExpand && (
                    <button
                        type="button"
                        onClick={() => onExpand(chart)}
                        title="View full screen"
                        data-testid="chart-expand-btn"
                        className="shrink-0 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                )}
            </div>
            <div className="mt-4 h-72 w-full">
                <ChartBody chart={chart} height="100%" />
            </div>
        </div>
    );
}

function FullscreenModal({ chart, onClose }) {
    if (!chart) return null;
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 sm:p-10"
            onClick={onClose}
            data-testid="chart-fullscreen-modal"
        >
            <div
                className="relative flex max-h-full w-full max-w-5xl flex-col rounded-2xl bg-white p-6 sm:p-8 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
                    data-testid="chart-fullscreen-close"
                >
                    <X className="h-5 w-5" />
                </button>
                <h3 className="font-heading text-xl font-semibold text-zinc-900 pr-8">{chart.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">
                    {chart.x_label} · {chart.y_label}
                </p>
                <div className="mt-6 h-[60vh] w-full">
                    <ChartBody chart={chart} height="100%" />
                </div>
            </div>
        </div>
    );
}

export default function ChartsPanel({ charts }) {
    const [tab, setTab] = useState(() => (charts?.[0]?.type ?? "bar"));
    const [view, setView] = useState("tabs"); // "tabs" (pick one type) | "grid" (show everything)
    const [fullscreenChart, setFullscreenChart] = useState(null);
    const grouped = useMemo(() => {
        const map = { trend: [], distribution: [], breakdown: [], composition: [] };
        for (const c of charts || []) {
            if (c.type === "line") map.trend.push(c);
            else if (c.type === "histogram") map.distribution.push(c);
            else if (c.type === "pie") map.composition.push(c);
            else map.breakdown.push(c);
        }
        return map;
    }, [charts]);

    if (!charts?.length) {
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 tactile-shadow">
                <p className="text-zinc-500">No charts detected — try a dataset with numeric or date columns.</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 tactile-shadow">
            <FullscreenModal chart={fullscreenChart} onClose={() => setFullscreenChart(null)} />
            <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {view === "tabs" ? "Pick a chart type" : "All charts"}
                </p>
                <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1">
                    <button
                        type="button"
                        onClick={() => setView("tabs")}
                        data-testid="view-tabs-btn"
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            view === "tabs" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                        }`}
                    >
                        <Rows3 className="h-3.5 w-3.5" /> One at a time
                    </button>
                    <button
                        type="button"
                        onClick={() => setView("grid")}
                        data-testid="view-grid-btn"
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            view === "grid" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                        }`}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" /> Show me everything
                    </button>
                </div>
            </div>

            {view === "grid" ? (
                <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 items-start" data-testid="charts-grid">
                    {(charts || []).map((c, i) => (
                        <div key={`g-${i}`} className="rounded-xl border border-zinc-100 p-4">
                            <ChartCard chart={c} onExpand={setFullscreenChart} />
                        </div>
                    ))}
                </div>
            ) : (
                <Tabs value={tab} onValueChange={setTab} data-testid="charts-tabs">
                    <TabsList className="mt-4 rounded-full bg-zinc-100 p-1">
                        {grouped.trend.length > 0 && (
                            <TabsTrigger value="line" className="rounded-full px-4" data-testid="tab-trend">
                                Trend
                            </TabsTrigger>
                        )}
                        {grouped.breakdown.length > 0 && (
                            <TabsTrigger value="bar" className="rounded-full px-4" data-testid="tab-breakdown">
                                Breakdown
                            </TabsTrigger>
                        )}
                        {grouped.composition.length > 0 && (
                            <TabsTrigger value="pie" className="rounded-full px-4" data-testid="tab-composition">
                                Pie / Composition
                            </TabsTrigger>
                        )}
                        {grouped.distribution.length > 0 && (
                            <TabsTrigger value="histogram" className="rounded-full px-4" data-testid="tab-distribution">
                                Distribution
                            </TabsTrigger>
                        )}
                    </TabsList>
                    <TabsContent value="line" className="mt-6">
                        {grouped.trend.map((c, i) => (
                            <ChartCard key={`t-${i}`} chart={c} onExpand={setFullscreenChart} />
                        ))}
                    </TabsContent>
                    <TabsContent value="bar" className="mt-6">
                        {grouped.breakdown.map((c, i) => (
                            <ChartCard key={`b-${i}`} chart={c} onExpand={setFullscreenChart} />
                        ))}
                    </TabsContent>
                    <TabsContent value="pie" className="mt-6">
                        {grouped.composition.map((c, i) => (
                            <ChartCard key={`p-${i}`} chart={c} onExpand={setFullscreenChart} />
                        ))}
                    </TabsContent>
                    <TabsContent value="histogram" className="mt-6">
                        {grouped.distribution.map((c, i) => (
                            <ChartCard key={`h-${i}`} chart={c} onExpand={setFullscreenChart} />
                        ))}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}