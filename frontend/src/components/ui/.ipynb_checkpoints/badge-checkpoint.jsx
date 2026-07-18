import React from "react";

const VARIANT_CLASSES = {
    default: "bg-zinc-900 text-white border-transparent",
    outline: "bg-transparent border",
    secondary: "bg-zinc-100 text-zinc-900 border-transparent",
};

export function Badge({ className = "", variant = "default", children, ...props }) {
    const classes = [
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
        className,
    ].join(" ");

    return (
        <span className={classes} {...props}>
            {children}
        </span>
    );
}

export default Badge;
