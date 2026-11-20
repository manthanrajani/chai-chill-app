"use client";

import { cn } from "@/lib/client";

/** Light-theme building blocks for the admin panel. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className }: { title?: React.ReactNode; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-cream-300 bg-white p-4 shadow-sm sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-display text-base font-bold text-stone-900">{title}</h2>}
            {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const inputCls = "w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-xs font-semibold text-stone-600", className)}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] font-normal text-stone-400">{hint}</span>}
    </label>
  );
}

export function Btn({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "dark" }) {
  const v = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    dark: "bg-espresso-900 text-brand-300 hover:bg-espresso-800",
    ghost: "border border-cream-300 bg-white text-stone-700 hover:border-brand-500",
    danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  }[variant];
  return <button {...p} className={cn("inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50", v, className)} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", checked ? "bg-emerald-500" : "bg-stone-300")}>
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition", checked ? "translate-x-5.5" : "translate-x-0.5")} />
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-cream-300 py-10 text-center text-sm text-stone-500">{children}</div>;
}

export const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

export function RangePicker({ range, from, to, onChange }: { range: RangeKey; from: string; to: string; onChange: (r: { range: RangeKey; from: string; to: string }) => void }) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-cream-300 bg-white p-1">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => onChange({ range: r.key, from, to })}
            className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition", range === r.key ? "bg-espresso-900 text-brand-300" : "text-stone-600 hover:bg-cream-100")}>
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex items-center gap-1.5 text-xs">
          <input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ range, from: e.target.value, to })} className="rounded-lg border border-cream-300 bg-white px-2 py-1.5" aria-label="From date" />
          <span className="text-stone-400">to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ range, from, to: e.target.value })} className="rounded-lg border border-cream-300 bg-white px-2 py-1.5" aria-label="To date" />
        </div>
      )}
    </div>
  );
}
