
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";

const TYPE_COLORS = {
    numeric: "bg-[#E6F4EA] text-emerald-800 border-emerald-200",
    datetime: "bg-[#FFF8E1] text-amber-800 border-amber-200",
    categorical: "bg-[#F3E8FF] text-violet-800 border-violet-200",
};

export default function DataPreview({ schema, preview, rowCount }) {
    if (!schema?.length) return null;
    const cols = schema.map((s) => s.name);

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 tactile-shadow" data-testid="data-preview">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-heading text-xl font-bold text-zinc-900">Data preview</h2>
                    <p className="text-sm text-zinc-500">
                        {rowCount?.toLocaleString?.() ?? rowCount} rows · showing first {preview?.length ?? 0}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
                {schema.map((s) => (
                    <Badge
                        key={s.name}
                        variant="outline"
                        className={`rounded-full font-normal ${TYPE_COLORS[s.type] || "bg-zinc-100 text-zinc-700"}`}
                    >
                        {s.name} <span className="ml-1 opacity-70">· {s.type}</span>
                    </Badge>
                ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-zinc-50">
                            {cols.map((c) => (
                                <TableHead key={c} className="text-zinc-700">
                                    {c}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(preview || []).map((row, i) => (
                            <TableRow key={i}>
                                {cols.map((c) => (
                                    <TableCell key={c} className="text-zinc-800 whitespace-nowrap">
                                        {formatCell(row[c])}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function formatCell(v) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") {
        return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
    }
    return String(v);
}
