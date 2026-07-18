import { BarChart3, LayoutGrid, LineChart, Table2, Trophy } from "lucide-react";

const NAV_ITEMS = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "trends", label: "Trends & Breakdown", icon: LineChart },
    { id: "performers", label: "Top & Bottom", icon: Trophy },
    { id: "data", label: "Data & Export", icon: Table2 },
];

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Sidebar({ dataset }) {
    const business = dataset?.summary?.business;
    const dim = business?.dimension_col;
    const segCount = business?.total_segments;
    const lossCount = business?.profitable_segments != null && segCount != null
        ? segCount - business.profitable_segments
        : null;

    return (
        <aside
            className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col justify-between bg-gradient-to-b from-[#0B1F26] to-[#123A45] text-white"
            data-testid="sidebar"
        >
            <div>
                <div className="flex items-center gap-2 px-6 py-6">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300">
                        <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-heading text-base font-bold leading-none">Insight Studio</p>
                        <p className="mt-1 text-[11px] text-white/50">Upload → Simplify → Understand</p>
                    </div>
                </div>

                <nav className="mt-4 px-3">
                    {dataset ? (
                        NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => scrollToSection(id)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                                data-testid={`nav-${id}`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))
                    ) : (
                        <p className="px-3 text-xs text-white/40">Upload a file to see sections here.</p>
                    )}
                </nav>
            </div>

            {dataset && dim && segCount != null && (
                <div className="px-4 pb-6">
                    <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-white/40">Tracking</p>
                        <p className="mt-1 font-heading text-lg font-bold">
                            {segCount} {dim}
                            {segCount === 1 ? "" : "s"}
                        </p>
                        {lossCount != null && (
                            <p className="mt-0.5 text-xs text-white/50">
                                {lossCount > 0 ? `${lossCount} currently loss-making` : "All currently profitable"}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}
