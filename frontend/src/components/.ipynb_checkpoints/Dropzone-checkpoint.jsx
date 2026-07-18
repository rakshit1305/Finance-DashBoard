
import { useState, useRef, useCallback } from "react";
import { UploadCloud, FileSpreadsheet } from "lucide-react";
import { Button } from "../components/ui/button";

export default function Dropzone({ onFiles, disabled, minimal }) {
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFiles = useCallback(
        (list) => {
            const files = Array.from(list || []).filter((f) =>
                /\.(csv|xlsx|xls)$/i.test(f.name),
            );
            if (files.length && onFiles) onFiles(files);
        },
        [onFiles],
    );

    const onDrop = useCallback(
        (e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            handleFiles(e.dataTransfer?.files);
        },
        [disabled, handleFiles],
    );

    if (minimal) {
        return (
            <>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    multiple
                    hidden
                    onChange={(e) => handleFiles(e.target.files)}
                    data-testid="upload-more-input"
                />
                <Button
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="rounded-full border-zinc-300"
                    data-testid="upload-more-btn"
                >
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload more files
                </Button>
            </>
        );
    }

    return (
        <div
            data-testid="dropzone"
            onDragOver={(e) => {
                e.preventDefault();
                if (!disabled) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-14 sm:p-20 text-center transition-colors ${
                dragOver
                    ? "border-emerald-400 bg-[#E6F4EA]"
                    : "border-zinc-300 bg-white hover:bg-[#FFF8E1]"
            } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
                data-testid="upload-input"
            />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                <UploadCloud className="h-7 w-7" />
            </div>
            <h2 className="font-heading mt-6 text-2xl sm:text-3xl font-bold text-zinc-900">
                Drop your Excel or CSV files here
            </h2>
            <p className="mt-2 text-zinc-500">
                Upload one file or a whole year's worth — we'll merge and clean them for you.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3 text-sm text-zinc-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> .csv
                </span>
            </div>
            <Button
                className="mt-8 rounded-full bg-zinc-900 px-6 hover:bg-zinc-800"
                data-testid="browse-btn"
            >
                Browse files
            </Button>
        </div>
    );
}
