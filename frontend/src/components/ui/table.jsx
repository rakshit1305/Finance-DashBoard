import React from "react";

export function Table({ className = "", children, ...props }) {
    return (
        <table className={`w-full caption-bottom text-sm ${className}`} {...props}>
            {children}
        </table>
    );
}

export function TableHeader({ className = "", children, ...props }) {
    return (
        <thead className={className} {...props}>
            {children}
        </thead>
    );
}

export function TableBody({ className = "", children, ...props }) {
    return (
        <tbody className={className} {...props}>
            {children}
        </tbody>
    );
}

export function TableRow({ className = "", children, ...props }) {
    return (
        <tr className={`border-b border-zinc-100 last:border-0 ${className}`} {...props}>
            {children}
        </tr>
    );
}

export function TableHead({ className = "", children, ...props }) {
    return (
        <th className={`h-10 px-3 text-left align-middle font-medium ${className}`} {...props}>
            {children}
        </th>
    );
}

export function TableCell({ className = "", children, ...props }) {
    return (
        <td className={`p-3 align-middle ${className}`} {...props}>
            {children}
        </td>
    );
}
