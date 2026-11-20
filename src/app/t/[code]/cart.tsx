"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Send, ShoppingBag, Loader2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { api, HttpError } from "@/lib/client";
import { formatINR } from "@/lib/money";
import type { Cart, MenuItem } from "./types";
import { VegMark } from "./menu";
import { usePersistentState } from "@/lib/use-persistent";

export function TaxLines({ subtotal, tax, gstRateBp }: { subtotal: number; tax: number; gstRateBp: number }) {
  const half = Math.floor(tax / 2);
  const pct = String(Number((gstRateBp / 200).toFixed(2)));
  return (
    <>
      <Row label="Item total" value={formatINR(subtotal)} />
      {gstRateBp > 0 && (
        <>
          <Row label={`CGST ${pct}%`} value={formatINR(half)} />
          <Row label={`SGST ${pct}%`} value={formatINR(tax - half)} />
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-stone-400">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function CartSheet(props: {
  open: boolean;
  onClose: () => void;
  code: string;
  cart: Cart;
  itemsById: Map<string, MenuItem>;
  summary: { count: number; subtotal: number; tax: number; total: number };
  gstRateBp: number;
  acceptingOrders: boolean;
  onChange: (id: string, delta: number) => void;
  onPlaced: (orderNo: number) => void;
  onMenuStale: () => void;
}) {
  const { open, onClose, code, cart, itemsById, summary, gstRateBp, onChange } = props;
  const toast = useToast();
  const [notes, setNotes] = useState("");
  const [name, setName] = usePersistentState<string>("cc:name", "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && summary.count === 0) onClose();
  }, [open, summary.count, onClose]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ item: itemsById.get(id), qty }))
    .filter((l): l is { item: MenuItem; qty: number } => !!l.item);
  const soldOut = lines.filter((l) => !l.item.available);

  async function place() {
    if (sending) return;
    setSending(true);
    try {
      const res = await api<{ order: { orderNo: number } }>(`/api/t/${code}/orders`, "POST", {
        items: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
        notes: notes.trim() || undefined,
        customerName: name.trim() || undefined,
      });
      setNotes("");
      props.onPlaced(res.order.orderNo);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not place order";
      toast("Order not sent", { body: msg, tone: "error" });
      if (e instanceof HttpError && e.status === 409) props.onMenuStale();
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your order"
      subtitle="Goes straight to the kitchen — no waiting for a waiter"
      icon={<div className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-400"><ShoppingBag className="size-5" /></div>}
      footer={
        <button
          onClick={place}
          disabled={sending || !props.acceptingOrders || soldOut.length > 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-black text-espresso-950 shadow-lg transition hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {!props.acceptingOrders ? "Ordering paused — call waiter" : soldOut.length ? "Remove sold-out items" : `Send order · ${formatINR(summary.total)}`}
        </button>
      }
    >
      <div className="space-y-2">
        {lines.map(({ item, qty }) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-800 bg-espresso-950 p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-2xl" aria-hidden>{item.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <VegMark veg={item.isVeg} /> <span className="truncate">{item.name}</span>
                </div>
                <div className="text-xs font-semibold text-amber-400">
                  {!item.available ? <span className="text-rose-400">Sold out — please remove</span> : `${formatINR(item.pricePaise)} × ${qty} = ${formatINR(item.pricePaise * qty)}`}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center rounded-lg bg-espresso-800 text-sm font-bold text-white">
              <button onClick={() => onChange(item.id, -1)} aria-label="Decrease" className="px-2.5 py-1.5 text-amber-400"><Minus className="size-3.5" /></button>
              <span className="min-w-5 text-center">{qty}</span>
              <button onClick={() => onChange(item.id, 1)} aria-label="Increase" disabled={!item.available} className="px-2.5 py-1.5 text-amber-400 disabled:opacity-30"><Plus className="size-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2.5">
        <label className="text-xs font-semibold text-stone-400">
          Cooking instructions (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="e.g. less sugar in chai, extra spicy Maggi…"
            className="mt-1 w-full rounded-xl border border-stone-800 bg-espresso-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
          />
        </label>
        <label className="text-xs font-semibold text-stone-400">
          Your name (optional — so we know who ordered)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Riya"
            className="mt-1 w-full rounded-xl border border-stone-800 bg-espresso-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500"
          />
        </label>
      </div>

      <div className="mt-4 space-y-1.5 rounded-2xl bg-espresso-950 p-3.5 text-xs">
        <TaxLines subtotal={summary.subtotal} tax={summary.tax} gstRateBp={gstRateBp} />
        <div className="flex justify-between border-t border-stone-800 pt-1.5 text-base font-extrabold text-amber-400">
          <span>To pay</span>
          <span>{formatINR(summary.total)}</span>
        </div>
        <p className="pt-1 text-[11px] text-stone-500">Pay at the end — everything you order is added to your table bill.</p>
      </div>
    </Sheet>
  );
}
