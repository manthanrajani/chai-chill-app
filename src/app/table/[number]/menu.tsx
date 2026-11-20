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
      <span className={cn("size-1.5 rounded-full", veg ? "bg-emerald-600" : "bg-rose-600")} />
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
      {/* search + categories stay pinned under the app bar */}
      <div className="sticky top-[57px] z-20 -mx-4 bg-paper/85 px-4 pb-3 pt-1 backdrop-blur-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kulhad chai, Maggi, pizza…"
            aria-label="Search the menu"
            className="w-full rounded-2xl border border-line bg-white py-3 pl-11 pr-10 text-sm text-ink shadow-card placeholder-ink-3 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-sand text-ink-2">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Pill active={category === "all"} onClick={() => setCategory("all")}>✨ All</Pill>
          {data.categories.map((c) => (
            <Pill key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.emoji} {c.name}
            </Pill>
          ))}
        </div>
      </div>

      {data.categories.length === 0 ? (
        <Empty emoji="📋" text="The menu is being updated. Please call the waiter to order." />
      ) : sections.length === 0 ? (
        <Empty emoji="🔍" text={`No dishes match “${query}”. Try something else?`} />
      ) : (
        <div className="mt-2 space-y-8">
          {sections.map((s) => (
            <section key={s.id + category + query}>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="flex items-center gap-2 font-serif text-[22px] font-semibold leading-none">
                  <span className="text-xl">{s.emoji}</span> {s.name}
                </h2>
                <span className="text-xs font-semibold text-ink-3">{s.items.length} items</span>
              </div>
              <div className="space-y-3">
                {s.items.map((item, i) => (
                  <MenuCard key={item.id} index={i} item={item} qty={cart[item.id] ?? 0} onChange={onChange} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-line-2 bg-white/60 px-6 py-14 text-center animate-fade-up">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 text-sm text-ink-2">{text}</p>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-all",
        active ? "bg-ink text-white shadow-card" : "border border-line bg-white text-ink-2 hover:border-brand-300 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const TAG_STYLE: Record<string, string> = {
  bestseller: "bg-amber-50 text-amber-800 ring-amber-200",
  "must try": "bg-brand-50 text-brand-700 ring-brand-200",
  "chef's special": "bg-violet-50 text-violet-700 ring-violet-200",
  spicy: "bg-rose-50 text-rose-700 ring-rose-200",
  new: "bg-sky-50 text-sky-700 ring-sky-200",
};
const TAG_ICON: Record<string, string> = { bestseller: "★ ", spicy: "🌶 ", "chef's special": "👨‍🍳 ", new: "✦ " };

function MenuCard({ item, qty, onChange, index }: { item: MenuItem; qty: number; onChange: (id: string, d: number) => void; index: number }) {
  const soldOut = !item.available;
  return (
    <article
      style={{ "--i": index } as React.CSSProperties}
      className={cn(
        "stagger flex gap-4 rounded-3xl bg-white p-4 shadow-card ring-1 transition-shadow hover:shadow-lift",
        qty > 0 ? "ring-brand-300" : "ring-line/70",
        soldOut && "opacity-60 grayscale-[40%]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5">
          <VegMark veg={item.isVeg} />
          {item.tags.map((t) => (
            <span key={t} className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", TAG_STYLE[t.toLowerCase()] ?? "bg-sand text-ink-2 ring-line")}>
              {TAG_ICON[t.toLowerCase()] ?? ""}{t}
            </span>
          ))}
        </div>
        <h3 className="mt-2 text-[15px] font-bold leading-snug text-ink">{item.name}</h3>
        <div className="mt-1 text-[15px] font-extrabold text-ink">{formatINR(item.pricePaise)}</div>
        {item.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{item.description}</p>}
      </div>

      <div className="relative w-[112px] shrink-0 pb-4">
        <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-sand to-sand-2 text-[52px]">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="size-full object-cover" loading="lazy" />
          ) : (
            <span aria-hidden className="drop-shadow-sm">{item.emoji}</span>
          )}
        </div>
        <div className="absolute inset-x-2 bottom-0">
          {soldOut ? (
            <span className="block rounded-xl bg-white py-2 text-center text-[11px] font-bold uppercase tracking-wide text-ink-3 shadow-card ring-1 ring-line">Sold out</span>
          ) : qty === 0 ? (
            <button
              onClick={() => onChange(item.id, 1)}
              aria-label={`Add ${item.name}`}
              className="press w-full rounded-xl bg-white py-2 text-[13px] font-extrabold tracking-wide text-brand-600 shadow-card ring-1 ring-brand-200 transition hover:bg-brand-50"
            >
              ADD +
            </button>
          ) : (
            <div key={qty} className="flex w-full items-center justify-between overflow-hidden rounded-xl bg-brand-600 text-sm font-extrabold text-white shadow-brand animate-bump">
              <button onClick={() => onChange(item.id, -1)} aria-label={`Remove one ${item.name}`} className="px-2.5 py-2 transition hover:bg-brand-700">
                <Minus className="size-3.5" />
              </button>
              <span>{qty}</span>
              <button onClick={() => onChange(item.id, 1)} aria-label={`Add one ${item.name}`} className="px-2.5 py-2 transition hover:bg-brand-700">
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
