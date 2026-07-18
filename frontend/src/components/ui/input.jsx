import React from "react";

export const Input = React.forwardRef(function Input({ className = "", type = "text", ...props }, ref) {
    const classes = [
        "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm",
        "placeholder:text-zinc-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
    ].join(" ");

    return <input ref={ref} type={type} className={classes} {...props} />;
});

export default Input;
