"use client";

import { useState } from "react";
import useSWR from "swr";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { api, cn, fetcher } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { Btn, Card, Empty, Field, PageHeader, Toggle, inputCls } from "@/components/admin-ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";

type Category = { id: string; name: string; emoji: string; sortOrder: number; active: boolean; _count?: { items: number } };
type Item = {
  id: string; name: string; description: string; pricePaise: number; emoji: string; imageUrl: string | null; isVeg: boolean;
  tags: string[]; available: boolean; sortOrder: number; categoryId: string; category: { name: string };
};

export default function MenuAdmin() {
  const toast = useToast();
  const menu = useSWR<{ items: Item[]; categories: Category[] }>("/api/admin/menu", fetcher);
  const cats = useSWR<{ categories: Category[] }>("/api/admin/categories", fetcher);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [filter, setFilter] = useState("all");

  const refresh = () => { menu.mutate(); cats.mutate(); };
  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast(ok); refresh(); return true; } catch (e) { toast((e as Error).message, { tone: "error" }); return false; }
  }

  const items = (menu.data?.items ?? []).filter((i) => filter === "all" || i.categoryId === filter);

  return (
    <div>
      <PageHeader
        title="Menu"
        subtitle="Changes show on every table instantly. Prices include no GST — GST is added on the bill."
        actions={<>
          <Btn variant="ghost" onClick={() => setEditingCat({ emoji: "🍽️", sortOrder: (cats.data?.categories.length ?? 0), active: true })}><Plus className="size-4" /> Category</Btn>
          <Btn onClick={() => setEditing({ isVeg: true, available: true, emoji: "🍽️", tags: [], sortOrder: 0, categoryId: cats.data?.categories[0]?.id })} disabled={!cats.data?.categories.length}><Plus className="size-4" /> Add dish</Btn>
        </>}
      />

      <Card title="Categories" className="mb-4">
        <div className="flex flex-wrap gap-2">
          {cats.data?.categories.map((c) => (
            <button key={c.id} onClick={() => setEditingCat(c)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", c.active ? "border-cream-300 bg-cream-50" : "border-dashed border-stone-300 text-stone-400")}>
              {c.emoji} {c.name} <span className="text-xs text-stone-400">{c._count?.items}</span> {!c.active && <span className="text-[10px] uppercase">hidden</span>}
              <Pencil className="size-3 text-stone-400" />
            </button>
          ))}
          {cats.data?.categories.length === 0 && <span className="text-sm text-stone-500">Add your first category to start building the menu.</span>}
        </div>
      </Card>

      <Card
        title={`Dishes (${items.length})`}
        actions={
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(inputCls, "w-auto py-1.5")}>
            <option value="all">All categories</option>
            {cats.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        }
      >
        {!menu.data ? <div className="h-40 animate-pulse rounded-xl bg-cream-100" /> : items.length === 0 ? <Empty>No dishes yet.</Empty> : (
          <div className="divide-y divide-cream-200">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-3">
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-cream-100 text-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.imageUrl ? <img src={i.imageUrl} alt="" className="size-full object-cover" /> : i.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("size-2.5 rounded-full", i.isVeg ? "bg-emerald-500" : "bg-rose-600")} title={i.isVeg ? "Veg" : "Non-veg"} />
                    <span className="truncate font-bold">{i.name}</span>
                    {i.tags.map((t) => <span key={t} className="rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-800">{t}</span>)}
                  </div>
                  <div className="truncate text-xs text-stone-500">{i.category.name} · {i.description}</div>
                </div>
                <div className="w-20 shrink-0 text-right font-bold tabular-nums">{formatINR(i.pricePaise)}</div>
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <Toggle checked={i.available} label={`${i.name} available`} onChange={(v) => run(() => api(`/api/admin/menu/${i.id}`, "PATCH", { available: v }), v ? `${i.name} is available` : `${i.name} marked sold out`)} />
                  <span className="text-[10px] text-stone-500">{i.available ? "On" : "Sold out"}</span>
                </div>
                <button onClick={() => setEditing(i)} className="rounded-lg p-2 text-stone-500 hover:bg-cream-100 hover:text-stone-900" aria-label={`Edit ${i.name}`}><Pencil className="size-4" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <ItemForm
          item={editing}
          categories={cats.data?.categories ?? []}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            const ok = await run(() => editing.id ? api(`/api/admin/menu/${editing.id}`, "PATCH", data) : api("/api/admin/menu", "POST", data), editing.id ? "Dish updated" : "Dish added");
            if (ok) setEditing(null);
          }}
          onDelete={editing.id ? async () => {
            if (!confirm(`Remove "${editing.name}" from the menu? Past orders and reports are kept.`)) return;
            if (await run(() => api(`/api/admin/menu/${editing.id}`, "DELETE"), "Dish removed")) setEditing(null);
          } : undefined}
        />
      )}
      {editingCat && (
        <CategoryForm
          cat={editingCat}
          onClose={() => setEditingCat(null)}
          onSave={async (data) => {
            const ok = await run(() => editingCat.id ? api(`/api/admin/categories/${editingCat.id}`, "PATCH", data) : api("/api/admin/categories", "POST", data), "Category saved");
            if (ok) setEditingCat(null);
          }}
          onDelete={editingCat.id ? async () => {
            if (!confirm(`Delete category "${editingCat.name}"?`)) return;
            if (await run(() => api(`/api/admin/categories/${editingCat.id}`, "DELETE"), "Category deleted")) setEditingCat(null);
          } : undefined}
        />
      )}
    </div>
  );
}

function ItemForm({ item, categories, onClose, onSave, onDelete }: { item: Partial<Item>; categories: Category[]; onClose: () => void; onSave: (d: object) => Promise<void>; onDelete?: () => void }) {
  const [f, setF] = useState({
    name: item.name ?? "",
    description: item.description ?? "",
    price: item.pricePaise != null ? String(item.pricePaise / 100) : "",
    emoji: item.emoji ?? "🍽️",
    imageUrl: item.imageUrl ?? "",
    isVeg: item.isVeg ?? true,
    tags: (item.tags ?? []).join(", "),
    available: item.available ?? true,
    sortOrder: String(item.sortOrder ?? 0),
    categoryId: item.categoryId ?? categories[0]?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const price = Number(f.price);
  const valid = f.name.trim() && f.categoryId && f.price !== "" && Number.isFinite(price) && price >= 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    await onSave({
      name: f.name.trim(), description: f.description.trim(), pricePaise: Math.round(price * 100), emoji: f.emoji.trim() || "🍽️",
      imageUrl: f.imageUrl.trim(), isVeg: f.isVeg, available: f.available, sortOrder: Number(f.sortOrder) || 0, categoryId: f.categoryId,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
    });
    setSaving(false);
  }

  return (
    <Sheet open onClose={onClose} title={item.id ? "Edit dish" : "Add dish"} className="sm:max-w-lg">
      <form onSubmit={submit} className="grid gap-3 text-stone-900">
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Field label="Dish name"><input required maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
          <Field label="Emoji"><input maxLength={8} value={f.emoji} onChange={(e) => set("emoji", e.target.value)} className={cn(inputCls, "text-center text-xl")} /></Field>
        </div>
        <Field label="Description"><textarea maxLength={300} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹, before GST)"><input required inputMode="decimal" type="number" min="0" step="0.5" value={f.price} onChange={(e) => set("price", e.target.value)} className={inputCls} /></Field>
          <Field label="Category">
            <select value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputCls}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Tags" hint="Comma separated, e.g. Bestseller, Spicy, New (max 5)"><input value={f.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} /></Field>
        <Field label="Photo URL (optional)" hint="Leave empty to show the emoji instead"><input type="url" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} className={inputCls} placeholder="https://…" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.isVeg} onChange={(v) => set("isVeg", v)} label="Vegetarian" /> Veg</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.available} onChange={(v) => set("available", v)} label="Available" /> Available</label>
          <Field label="Sort order"><input type="number" min="0" max="999" value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          {onDelete ? <Btn type="button" variant="danger" onClick={onDelete}><Trash2 className="size-4" /> Remove</Btn> : <span />}
          <Btn type="submit" disabled={!valid || saving}>{saving && <Loader2 className="size-4 animate-spin" />} Save dish</Btn>
        </div>
      </form>
    </Sheet>
  );
}

function CategoryForm({ cat, onClose, onSave, onDelete }: { cat: Partial<Category>; onClose: () => void; onSave: (d: object) => Promise<void>; onDelete?: () => void }) {
  const [name, setName] = useState(cat.name ?? "");
  const [emoji, setEmoji] = useState(cat.emoji ?? "🍽️");
  const [sortOrder, setSortOrder] = useState(String(cat.sortOrder ?? 0));
  const [active, setActive] = useState(cat.active ?? true);
  return (
    <Sheet open onClose={onClose} title={cat.id ? "Edit category" : "New category"}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim(), emoji: emoji.trim() || "🍽️", sortOrder: Number(sortOrder) || 0, active }); }}>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Field label="Name"><input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Emoji"><input maxLength={8} value={emoji} onChange={(e) => setEmoji(e.target.value)} className={cn(inputCls, "text-center text-xl")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Position" hint="Lower shows first"><input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} /></Field>
          <label className="flex items-center gap-2 pt-5 text-sm font-semibold"><Toggle checked={active} onChange={setActive} label="Visible" /> Visible to customers</label>
        </div>
        <div className="mt-2 flex justify-between">
          {onDelete ? <Btn type="button" variant="danger" onClick={onDelete}><Trash2 className="size-4" /> Delete</Btn> : <span />}
          <Btn type="submit" disabled={!name.trim()}>Save</Btn>
        </div>
      </form>
    </Sheet>
  );
}
