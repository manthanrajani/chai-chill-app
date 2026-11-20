"use client";

import { useState } from "react";
import { ChefHat, ChevronRight, CircleCheck, Clock, Gamepad2, Loader2, ReceiptText, Smartphone, Utensils, Receipt, HandCoins } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { api, clockTime, cn, useNow } from "@/lib/client";
import { formatINR } from "@/lib/money";
import type { CustomerOrder, TableResponse } from "./types";
import { TaxLines } from "./cart";

const STEPS = [
  { key: "PLACED", label: "Order sent", icon: Receipt },
  { key: "PREPARING", label: "Cooking", icon: ChefHat },
  { key: "READY", label: "Ready", icon: Utensils },
  { key: "SERVED", label: "Served", icon: CircleCheck },
] as const;
const STEP_INDEX: Record<string, number> = { PLACED: 0, PREPARING: 1, READY: 2, SERVED: 3 };

const STATUS_TEXT: Record<string, string> = {
  PLACED: "Waiting for the kitchen to accept",
  PREPARING: "The chef is cooking your food 👨‍🍳",
  READY: "Ready! Coming to your table 🍽️",
  SERVED: "Served — enjoy your meal!",
  CANCELLED: "Cancelled",
};

const mins = (ms: number) => Math.max(0, Math.round(ms / 60_000));
const isActive = (o: CustomerOrder) => o.status === "PLACED" || o.status === "PREPARING" || o.status === "READY";

/** Small live status strip shown above the menu — tap to open the Orders tab. */
export function OrdersStrip({ orders, onOpen }: { orders: CustomerOrder[]; onOpen: () => void }) {
  const now = useNow(15_000);
  const active = orders.filter(isActive);
  if (!active.length) return null;
  const ready = active.filter((o) => o.status === "READY").length;
  const cooking = active.filter((o) => o.status === "PREPARING").length;
  const waiting = active.filter((o) => o.status === "PLACED").length;
  const soonest = active
    .map((o) => o.estimate?.readyBy)
    .filter((x): x is string => !!x)
    .sort()[0];
  const eta = soonest ? mins(new Date(soonest).getTime() - now) : null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] animate-pop",
        ready ? "border-emerald-500/60 bg-emerald-500/10" : "border-brand-500/40 bg-white",
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", ready ? "bg-emerald-600 text-white" : "bg-brand-600/15 text-brand-600")}>
        {ready ? <Utensils className="size-5" /> : <ChefHat className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-bold", ready ? "text-emerald-700" : "text-brand-600")}>
          {ready ? `${ready} order${ready > 1 ? "s" : ""} ready — coming to you!` : eta !== null ? `Food ready in ~${Math.max(1, eta)} min` : "Order sent to kitchen"}
        </span>
        <span className="block truncate text-xs text-ink-2">
          {[waiting && `${waiting} waiting`, cooking && `${cooking} cooking`, ready && `${ready} ready`].filter(Boolean).join(" · ")} · tap to track
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}

/** Full order tracking for the table: what's pending, cooking, ready, served and how long it took. */
export function OrdersTab({
  code, data, onPlay, onRefresh, onMenu, onBill,
}: { code: string; data: TableResponse; onPlay: () => void; onRefresh: () => void; onMenu: () => void; onBill: () => void }) {
  const toast = useToast();
  const now = useNow(10_000);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const orders = data.bill?.orders ?? [];
  const active = orders.filter(isActive);
  const done = orders.filter((o) => !isActive(o));
  const count = (st: string) => orders.filter((o) => o.status === st).length;

  async function cancel(o: CustomerOrder) {
    if (!confirm(`Cancel order #${o.orderNo}?`)) return;
    setCancelling(o.id);
    try {
      await api(`/api/table/${code}/orders/${o.id}/cancel`, "POST");
      toast(`Order #${o.orderNo} cancelled`, { tone: "info" });
    } catch (e) {
      toast("Couldn't cancel", { body: (e as Error).message, tone: "error" });
    } finally {
      setCancelling(null);
      onRefresh();
    }
  }

  if (!orders.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
        <div className="text-5xl">🧾</div>
        <h2 className="mt-3 font-display text-lg font-extrabold text-ink">No orders yet</h2>
        <p className="mt-1 text-sm text-ink-2">Add something tasty from the menu — you can track it live right here.</p>
        <button onClick={onMenu} className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-extrabold text-white">Browse menu</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Count label="Waiting" value={count("PLACED")} tone="text-brand-600" />
        <Count label="Cooking" value={count("PREPARING")} tone="text-sky-700" />
        <Count label="Ready" value={count("READY")} tone="text-emerald-700" />
        <Count label="Served" value={count("SERVED")} tone="text-ink" />
      </div>
      <p className="text-center text-[11px] text-ink-3">Our kitchen usually takes about {data.kitchen.avgPrepMinutes} min per order</p>

      {active.map((o) => (
        <ActiveOrderCard key={o.id} o={o} now={now} cancelling={cancelling === o.id} onCancel={() => cancel(o)} onPlay={onPlay} />
      ))}

      {done.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Earlier orders</h3>
          <div className="space-y-2">
            {done.map((o) => (
              <div key={o.id} className={cn("rounded-2xl border border-line bg-white p-3", o.status === "CANCELLED" && "opacity-60")}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-ink">Order #{o.orderNo}</span>
                  {o.status === "SERVED" ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CircleCheck className="size-3" /> Served{o.readyAt && ` · took ${mins(new Date(o.readyAt).getTime() - new Date(o.createdAt).getTime())} min`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-600">Cancelled</span>
                  )}
                </div>
                <p className={cn("mt-1 text-xs text-ink-2", o.status === "CANCELLED" && "line-through")}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                <p className="mt-1 text-[11px] text-ink-3">
                  Ordered {clockTime(o.createdAt)}{o.servedAt && ` · served ${clockTime(o.servedAt)}`} · {formatINR(o.totalPaise)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.bill && (
        <button onClick={onBill} className="flex w-full items-center justify-between rounded-2xl border border-brand-500/40 bg-brand-600/10 p-4 text-left">
          <span>
            <span className="block text-xs font-semibold text-brand-600">Table bill so far</span>
            <span className="font-display text-xl font-extrabold text-brand-600">{formatINR(data.bill.totalPaise)}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-brand-600">View & pay <ChevronRight className="size-4" /></span>
        </button>
      )}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white py-2.5">
      <div className={cn("font-display text-2xl font-black tabular-nums", value ? tone : "text-ink-3")}>{value}</div>
      <div className="text-[11px] font-semibold text-ink-2">{label}</div>
    </div>
  );
}

function ActiveOrderCard({ o, now, cancelling, onCancel, onPlay }: { o: CustomerOrder; now: number; cancelling: boolean; onCancel: () => void; onPlay: () => void }) {
  const step = STEP_INDEX[o.status] ?? 0;
  const placed = new Date(o.createdAt).getTime();
  const elapsed = mins(now - placed);
  const readyBy = o.estimate ? new Date(o.estimate.readyBy).getTime() : null;
  const left = readyBy ? mins(readyBy - now) : null;
  const total = readyBy ? Math.max(1, readyBy - placed) : 1;
  const pct = o.status === "READY" ? 100 : readyBy ? Math.min(95, Math.max(5, ((now - placed) / total) * 100)) : 5;
  const stepTime = [o.createdAt, o.preparingAt, o.readyAt, o.servedAt];
  const ready = o.status === "READY";

  return (
    <article className={cn("overflow-hidden rounded-3xl border bg-white shadow-lg animate-pop", ready ? "border-emerald-500/70" : "border-brand-500/40")}>
      <div className={cn("p-4", ready ? "bg-emerald-500/10" : "bg-brand-600/5")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-extrabold text-ink">Order #{o.orderNo}</h2>
          <span className="flex items-center gap-1 text-[11px] text-ink-2"><Clock className="size-3" /> {elapsed ? `${elapsed} min ago` : "just now"}</span>
        </div>
        <p className={cn("mt-0.5 text-sm font-semibold", ready ? "text-emerald-700" : "text-brand-700")}>{STATUS_TEXT[o.status]}</p>

        {/* ETA */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{ready ? "Status" : "Estimated ready"}</div>
            <div className={cn("font-display text-3xl font-black leading-none", ready ? "text-emerald-700" : "text-brand-600")}>
              {ready ? "Ready ✓" : left !== null ? (left <= 2 ? "Any minute" : `~${left} min`) : "—"}
            </div>
          </div>
          {!ready && readyBy && <div className="text-right text-xs text-ink-2">by <b className="text-ink">{clockTime(new Date(readyBy))}</b></div>}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full transition-all duration-700", ready ? "bg-emerald-600" : "bg-gradient-to-r from-brand-500 to-brand-600")} style={{ width: `${pct}%` }} />
        </div>
        {!ready && o.estimate && o.estimate.ordersAhead > 0 && (
          <p className="mt-1.5 text-[11px] text-ink-2">{o.estimate.ordersAhead} order{o.estimate.ordersAhead > 1 ? "s" : ""} ahead of you in the kitchen</p>
        )}
      </div>

      <div className="p-4 pt-3">
        {/* timeline */}
        <ol className="grid grid-cols-4 gap-1.5 text-center">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < step || (i === step && s.key === "SERVED");
            const isNow = i === step;
            const t = stepTime[i];
            return (
              <li key={s.key} className="flex flex-col items-center">
                <span className={cn(
                  "grid size-9 place-items-center rounded-full border-2",
                  isNow && !isDone && (s.key === "READY" ? "border-emerald-400 bg-emerald-600 text-white" : "border-brand-400 bg-brand-600 text-white"),
                  isDone && "border-emerald-500/60 bg-emerald-500/15 text-emerald-700",
                  !isNow && !isDone && "border-line-2 bg-sand-2 text-ink-3",
                )}>
                  {isDone ? <CircleCheck className="size-4" /> : <Icon className={cn("size-4", isNow && "animate-pulse")} />}
                </span>
                <span className={cn("mt-1 text-[10px] font-bold", isNow || isDone ? "text-ink" : "text-ink-3")}>{s.label}</span>
                <span className="text-[10px] text-ink-3">{t ? clockTime(t) : i === 2 && readyBy ? `~${clockTime(new Date(readyBy))}` : "–"}</span>
              </li>
            );
          })}
        </ol>

        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2 text-ink">
              <span><span className="font-bold text-brand-600">{i.qty}×</span> {i.name}</span>
              <span className="shrink-0 tabular-nums text-ink-2">{formatINR(i.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        {o.notes && <p className="mt-2 rounded-lg bg-sand px-2.5 py-1.5 text-[11px] text-ink-2">📝 {o.notes}</p>}

        <div className="mt-3 flex items-center justify-between gap-2">
          {o.status === "PLACED" ? (
            <button onClick={onCancel} disabled={cancelling} className="text-xs font-bold text-rose-600 hover:text-rose-600 disabled:opacity-50">
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          ) : (
            <span className="text-xs text-ink-3">{ready ? "Waiter is bringing it now" : "Can't cancel once cooking starts"}</span>
          )}
          {!ready && (
            <button onClick={onPlay} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700">
              <Gamepad2 className="size-3.5" /> Play while you wait
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const ORDER_BADGE: Record<string, string> = {
  PLACED: "bg-brand-600/15 text-brand-600",
  PREPARING: "bg-sky-500/15 text-sky-700",
  READY: "bg-emerald-500/15 text-emerald-700",
  SERVED: "bg-sand-2 text-ink-2",
  CANCELLED: "bg-rose-500/15 text-rose-600 line-through",
};

export function BillSheet({ open, onClose, code, data, onRefresh }: { open: boolean; onClose: () => void; code: string; data: TableResponse; onRefresh: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const { bill, cafe, table, requests } = data;
  const billRequested = requests.some((r) => r.type === "BILL");

  async function request(message?: string) {
    setBusy(message ? "paid" : "bill");
    try {
      await api(`/api/table/${code}/requests`, "POST", { type: "BILL", message });
      toast(message ? "Staff notified about your payment" : "Bill requested", { body: "Someone will be at your table shortly." });
      onRefresh();
    } catch (e) {
      toast("Couldn't send", { body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!bill) return null;
  const upiLink = cafe.upiId
    ? `upi://pay?${new URLSearchParams({
        pa: cafe.upiId,
        pn: cafe.name,
        am: (bill.totalPaise / 100).toFixed(2),
        cu: "INR",
        tn: `Bill ${bill.billNo} Table ${table.number}`,
      }).toString()}`
    : null;
  const live = bill.orders.filter((o) => o.status !== "CANCELLED");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Table ${String(table.number).padStart(2, "0")} bill`}
      subtitle={`Bill #${bill.billNo} · opened ${clockTime(bill.openedAt)}`}
      icon={<div className="grid size-10 place-items-center rounded-xl bg-brand-600/15 text-brand-600"><ReceiptText className="size-5" /></div>}
      footer={
        <div className="grid gap-2">
          {upiLink && (
            <a href={upiLink} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 py-3.5 text-sm font-black text-white shadow-lg active:scale-[0.98]">
              <Smartphone className="size-4" /> Pay {formatINR(bill.totalPaise)} via UPI app
            </a>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => request()}
              disabled={!!busy || billRequested}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line-2 bg-sand py-3 text-xs font-bold text-ink disabled:opacity-60"
            >
              {busy === "bill" ? <Loader2 className="size-3.5 animate-spin" /> : <ReceiptText className="size-3.5" />}
              {billRequested ? "Bill requested ✓" : "Bring bill to table"}
            </button>
            <button
              onClick={() => request(`Paid ${formatINR(bill.totalPaise)} via UPI — please verify & close bill #${bill.billNo}`)}
              disabled={!!busy}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-xs font-bold text-emerald-700 disabled:opacity-60"
            >
              {busy === "paid" ? <Loader2 className="size-3.5 animate-spin" /> : <HandCoins className="size-3.5" />}
              I&apos;ve paid
            </button>
          </div>
          <p className="text-center text-[11px] text-ink-3">Cash or card? Tap “Bring bill to table”. Staff closes the bill after payment.</p>
        </div>
      }
    >
      <div className="space-y-2.5">
        {bill.orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-line bg-sand p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-bold text-ink-2">Order #{o.orderNo} · {clockTime(o.createdAt)}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ORDER_BADGE[o.status])}>{o.status.toLowerCase()}</span>
            </div>
            <ul className={cn("space-y-1 text-sm", o.status === "CANCELLED" && "text-ink-3 line-through")}>
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{i.qty} × {i.name}</span>
                  <span className="shrink-0 tabular-nums">{formatINR(i.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 rounded-2xl bg-sand p-3.5 text-xs">
        <TaxLines subtotal={bill.subtotalPaise} tax={bill.taxPaise} gstRateBp={cafe.gstRateBp} />
        <div className="flex justify-between border-t border-line pt-1.5 text-base font-extrabold text-brand-600">
          <span>Grand total ({live.length} order{live.length === 1 ? "" : "s"})</span>
          <span>{formatINR(bill.totalPaise)}</span>
        </div>
        {cafe.gstin && <p className="pt-1 text-[10px] text-ink-3">GSTIN {cafe.gstin}</p>}
      </div>
    </Sheet>
  );
}
