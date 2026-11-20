"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/client";
import { formatINR } from "@/lib/money";
import type { Cart, MenuItem, MenuResponse } from "./types";

export function VegMark({ veg = true, className }: { veg?: boolean; className?: string }) {
  return (
    <span
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      className={cn("inline-grid size-3.5 shrink-0 place-items-center rounded-[3px] border", veg ? "border-emerald-500" : "border-rose-600", className)}
    >
      <span className={cn("size-1.5 rounded-full", veg ? "bg-emerald-500" : "bg-rose-600")} />
    </span>
  );
}

export function MenuView({ data, cart, onChange }: { data: MenuResponse; cart: Cart; onChange: (id: string, delta: number) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.categories
      .filter((c) => category === "all" || c.id === category)
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q))),
      }))
      .filter((c) => c.items.length > 0);
  }, [data.categories, query, category]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search kulhad chai, Maggi, pizza…"
          className="w-full rounded-2xl border border-stone-800 bg-espresso-900 py-3 pl-10 pr-10 text-sm text-white placeholder-stone-500 outline-none transition focus:border-amber-500"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1">
        <Pill active={category === "all"} onClick={() => setCategory("all")}>✨ All</Pill>
        {data.categories.map((c) => (
          <Pill key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.emoji} {c.name}
          </Pill>
        ))}
      </div>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-800 py-12 text-center text-sm text-stone-500">
          No dishes match “{query}”. Try something else?
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.id}>
              <h2 className="mb-2.5 flex items-center gap-2 font-display text-base font-extrabold text-white">
                <span>{s.emoji}</span> {s.name}
                <span className="text-xs font-semibold text-stone-500">({s.items.length})</span>
              </h2>
              <div className="space-y-2.5">
                {s.items.map((item) => (
                  <MenuCard key={item.id} item={item} qty={cart[item.id] ?? 0} onChange={onChange} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition",
        active ? "bg-amber-500 text-espresso-950 shadow" : "border border-stone-800 bg-espresso-900 text-stone-300 hover:border-amber-500/40",
      )}
    >
      {children}
    </button>
  );
}

const TAG_STYLE: Record<string, string> = {
  bestseller: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  spicy: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  new: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

function MenuCard({ item, qty, onChange }: { item: MenuItem; qty: number; onChange: (id: string, d: number) => void }) {
  const soldOut = !item.available;
  return (
    <div
      className={cn(
        "flex items-stretch gap-3 rounded-2xl border bg-espresso-900 p-3.5 transition",
        qty > 0 ? "border-amber-500/50" : "border-stone-800/90",
        soldOut && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <VegMark veg={item.isVeg} />
          {item.tags.map((t) => (
            <span key={t} className={cn("rounded-full border px-1.5 py-px text-[10px] font-bold", TAG_STYLE[t.toLowerCase()] ?? "border-stone-700 bg-espresso-800 text-stone-300")}>
              {t}
            </span>
          ))}
        </div>
        <h3 className="font-display text-[15px] font-bold leading-snug text-white">{item.name}</h3>
        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-stone-400">{item.description}</p>}
        <div className="mt-auto pt-2 text-sm font-extrabold text-amber-400">{formatINR(item.pricePaise)}</div>
      </div>

      <div className="flex w-24 shrink-0 flex-col items-center gap-2">
        <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-stone-800 bg-espresso-950 text-4xl shadow-inner">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="size-full object-cover" loading="lazy" />
          ) : (
            <span aria-hidden>{item.emoji}</span>
          )}
        </div>
        {soldOut ? (
          <span className="w-full rounded-xl border border-stone-700 py-1.5 text-center text-[11px] font-bold uppercase text-stone-400">Sold out</span>
        ) : qty === 0 ? (
          <button
            onClick={() => onChange(item.id, 1)}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-500/15 py-1.5 text-xs font-extrabold text-amber-400 transition hover:bg-amber-500 hover:text-espresso-950 active:scale-95"
          >
            ADD +
          </button>
        ) : (
          <div className="flex w-full items-center justify-between overflow-hidden rounded-xl bg-amber-500 text-xs font-black text-espresso-950 shadow">
            <button onClick={() => onChange(item.id, -1)} aria-label={`Remove one ${item.name}`} className="px-2.5 py-2 hover:bg-amber-400">
              <Minus className="size-3.5" />
            </button>
            <span>{qty}</span>
            <button onClick={() => onChange(item.id, 1)} aria-label={`Add one ${item.name}`} className="px-2.5 py-2 hover:bg-amber-400">
              <Plus className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
