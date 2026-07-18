import React from "react";

const VARIANT_CLASSES = {
    default: "bg-zinc-900 text-white hover:bg-zinc-800",
    outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
    ghost: "bg-transparent text-zinc-900 hover:bg-zinc-100",
    destructive: "bg-red-600 text-white hover:bg-red-700",
};

const SIZE_CLASSES = {
    default: "h-10 px-4 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-6 text-base",
    icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef(function Button(
    { className = "", variant = "default", size = "default", disabled, children, ...props },
    ref,
) {
    const classes = [
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
        SIZE_CLASSES[size] || SIZE_CLASSES.default,
        className,
    ].join(" ");

    return (
        <button ref={ref} className={classes} disabled={disabled} {...props}>
            {children}
        </button>
    );
});

export default Button;
