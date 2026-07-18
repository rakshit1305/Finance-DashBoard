import React, { createContext, useContext } from "react";

const TabsContext = createContext(null);

export function Tabs({ value, onValueChange, className = "", children, ...props }) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={className} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className = "", children, ...props }) {
    return (
        <div role="tablist" className={`inline-flex items-center gap-1 ${className}`} {...props}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, className = "", children, ...props }) {
    const ctx = useContext(TabsContext);
    const active = ctx?.value === value;
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => ctx?.onValueChange?.(value)}
            className={`transition-colors ${
                active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            } ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, className = "", children, ...props }) {
    const ctx = useContext(TabsContext);
    if (ctx?.value !== value) return null;
    return (
        <div className={className} {...props}>
            {children}
        </div>
    );
}
