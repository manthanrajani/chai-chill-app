"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  BellRing, Check, ChefHat, Clock, CookingPot, LayoutDashboard, LayoutGrid, Loader2, LogOut, PauseCircle, PlayCircle,
  Printer, ReceiptText, Soup, UtensilsCrossed, Volume2, VolumeX, X, Ban, Banknote, CreditCard, Smartphone,
} from "lucide-react";
import { api, clockTime, cn, fetcher, HttpError, minutesSince } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { chime, unlockAudio } from "@/lib/sound";
import { useToast } from "@/components/toast";
import { Sheet } from "@/components/sheet";
import { usePersistentState } from "@/lib/use-persistent";

type OrderStatus = "PLACED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
type LiveOrder = {
  id: string; orderNo: number; tableId: number; status: OrderStatus; notes: string | null; customerName: string | null;
  totalPaise: number; createdAt: string; preparingAt: string | null; readyAt: string | null; servedAt: string | null;
  table: { number: number; label: string | null }; items: { id: string; name: string; qty: number }[];
};
type LiveRequest = { id: string; tableId: number; type: string; message: string; createdAt: string; table: { number: number } };
type FloorTable = {
  id: number; number: number; label: string | null; seats: number;
  status: "vacant" | "online" | "seated" | "food" | "attention"; activeOrders: number; openRequests: number;
  bill: null | {
    id: string; billNo: number; subtotalPaise: number; taxPaise: number; totalPaise: number; openedAt: string;
    orders: { id: string; orderNo: number; status: OrderStatus; totalPaise: number; items: { name: string; qty: number; lineTotalPaise: number }[] }[];
  };
};
type Live = { serverTime: string; acceptingOrders: boolean; gstRateBp: number; cafeName: string; orders: LiveOrder[]; requests: LiveRequest[]; floor: FloorTable[] };

const pad = (n: number) => String(n).padStart(2, "0");

export function KitchenApp() {
  const toast = useToast();
  const router = useRouter();
  const live = useSWR<Live>("/api/staff/live", fetcher, { refreshInterval: 3000, revalidateOnFocus: true });
  const me = useSWR<{ user: { name: string; role: "ADMIN" | "STAFF" } | null }>("/api/auth/me", fetcher);
  const [tab, setTab] = useState<"orders" | "floor" | "menu">("orders");
  const [sound, setSoundPref] = usePersistentState<boolean>("cc:kitchen-sound", false);
  const [billTable, setBillTable] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // session expired → back to login
  useEffect(() => {
    if (live.error instanceof HttpError && live.error.status === 401) router.replace("/login?next=/kitchen");
  }, [live.error, router]);

  // ring for new orders / new requests
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!live.data) return;
    const ids = new Set([...live.data.orders.filter((o) => o.status === "PLACED").map((o) => o.id), ...live.data.requests.map((r) => r.id)]);
    if (seen.current) {
      const fresh = [...ids].filter((id) => !seen.current!.has(id));
      if (fresh.length) {
        const newOrders = live.data.orders.filter((o) => fresh.includes(o.id));
        const newReqs = live.data.requests.filter((r) => fresh.includes(r.id));
        if (sound) chime(newOrders.length ? "order" : "alert");
        newOrders.forEach((o) => toast(`New order #${o.orderNo} — Table ${pad(o.table.number)}`, { body: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "), tone: "warning" }));
        newReqs.forEach((r) => toast(`Table ${pad(r.table.number)}: ${r.message}`, { tone: "error" }));
      }
    }
    seen.current = ids;
  }, [live.data, sound, toast]);

  // keep the screen awake on kitchen tablets
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release();
  }, []);

  const data = live.data;
  const byStatus = useMemo(() => {
    const g: Record<OrderStatus, LiveOrder[]> = { PLACED: [], PREPARING: [], READY: [], SERVED: [], CANCELLED: [] };
    data?.orders.forEach((o) => g[o.status].push(o));
    g.SERVED.reverse();
    return g;
  }, [data]);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toast(ok);
      await live.mutate();
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
      live.mutate();
    }
  }

  const setOrder = (o: LiveOrder, status: OrderStatus, reason?: string) =>
    act(() => api(`/api/staff/orders/${o.id}`, "PATCH", { status, reason }), status === "CANCELLED" ? `Order #${o.orderNo} cancelled` : undefined);

  if (!data) {
    return <div className="grid min-h-dvh flex-1 place-items-center bg-espresso-950 text-stone-400">{live.error ? (live.error as Error).message : <Loader2 className="size-6 animate-spin" />}</div>;
  }

  const occupied = data.floor.filter((t) => t.status !== "vacant" && t.status !== "online").length;
  const selectedTable = data.floor.find((t) => t.id === billTable) ?? null;

  return (
    <>
    <div className="no-print flex min-h-dvh flex-1 flex-col bg-espresso-950 text-stone-100 selection:bg-brand-500 selection:text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-brand-500/20 bg-espresso-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-brand-400 to-brand-600 text-lg">☕</div>
            <div>
              <div className="font-display text-sm font-extrabold leading-tight text-white sm:text-base">{data.cafeName}</div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live · {clockTime(new Date(now))}
              </div>
            </div>
          </div>

          <nav className="order-3 flex w-full gap-1 rounded-xl border border-stone-800 bg-espresso-900 p-1 sm:order-none sm:w-auto">
            <TopTab active={tab === "orders"} onClick={() => setTab("orders")} icon={<ChefHat className="size-4" />} label="Orders" count={byStatus.PLACED.length + data.requests.length} />
            <TopTab active={tab === "floor"} onClick={() => setTab("floor")} icon={<LayoutGrid className="size-4" />} label="Tables & bills" />
            <TopTab active={tab === "menu"} onClick={() => setTab("menu")} icon={<Soup className="size-4" />} label="Sold out" />
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => act(() => api("/api/staff/settings", "PATCH", { acceptingOrders: !data.acceptingOrders }), data.acceptingOrders ? "Online ordering paused" : "Online ordering resumed")}
              className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold", data.acceptingOrders ? "border-emerald-500/40 text-emerald-300" : "border-brand-500 bg-brand-500/15 text-brand-300")}
              title="Pause or resume QR ordering"
            >
              {data.acceptingOrders ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
              <span className="hidden md:inline">{data.acceptingOrders ? "Taking orders" : "Orders paused"}</span>
            </button>
            <button
              onClick={() => {
                unlockAudio();
                const next = !sound;
                setSoundPref(next);
                if (next) chime("order");
              }}
              className={cn("rounded-lg border px-2.5 py-2", sound ? "border-brand-500/50 text-brand-300" : "border-rose-500/50 bg-rose-500/10 text-rose-300")}
              title={sound ? "Sound on" : "Sound off — tap to enable alerts"}
            >
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
            {me.data?.user?.role === "ADMIN" && (
              <Link href="/admin" className="rounded-lg border border-stone-700 px-2.5 py-2 text-stone-300 hover:text-white" title="Owner dashboard">
                <LayoutDashboard className="size-4" />
              </Link>
            )}
            <button onClick={async () => { await api("/api/auth/logout", "POST"); router.replace("/login"); }} className="rounded-lg border border-stone-700 px-2.5 py-2 text-stone-300 hover:text-white" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        {!sound && (
          <button onClick={() => { unlockAudio(); setSoundPref(true); chime("order"); }} className="block w-full bg-rose-500/15 py-1.5 text-center text-xs font-bold text-rose-200">
            🔇 Sound alerts are off — tap here to turn on the new-order bell
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 p-3 sm:p-5">
        {/* stats */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <Stat label="New orders" value={byStatus.PLACED.length} tone="text-brand-400" />
          <Stat label="Preparing" value={byStatus.PREPARING.length} tone="text-sky-400" />
          <Stat label="Ready to serve" value={byStatus.READY.length} tone="text-emerald-400" />
          <Stat label="Table requests" value={data.requests.length} tone="text-rose-400" />
          <Stat label="Tables occupied" value={`${occupied}/${data.floor.length}`} tone="text-stone-100" />
        </div>

        {tab === "orders" && (
          <>
            {data.requests.length > 0 && (
              <section className="rounded-2xl border border-rose-500/30 bg-espresso-900 p-3 sm:p-4">
                <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                  <BellRing className="size-4 animate-bounce text-rose-400" /> Table requests
                </h2>
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                  {data.requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/50 bg-espresso-950 p-3 animate-pulse-ring">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-rose-500 px-2 py-0.5 text-xs font-black text-white">Table {pad(r.table.number)}</span>
                          <span className="text-[11px] text-stone-400">{minutesSince(r.createdAt, now)} min</span>
                        </div>
                        <div className="mt-1 text-sm font-bold text-white">{r.message}</div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {r.type === "BILL" && (
                          <button onClick={() => { setBillTable(r.tableId); }} className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-extrabold text-espresso-950">Open bill</button>
                        )}
                        <button onClick={() => act(() => api(`/api/staff/requests/${r.id}`, "PATCH"))} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-extrabold text-espresso-950">
                          <Check className="size-3.5" /> Done
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Column title="New" icon={<ReceiptText className="size-4" />} tone="border-brand-500/60" count={byStatus.PLACED.length} empty="No new orders">
                {byStatus.PLACED.map((o) => (
                  <Ticket key={o.id} o={o} now={now} accent="border-brand-500" actions={
                    <>
                      <button onClick={() => { const r = prompt(`Cancel order #${o.orderNo}? Reason (shown in reports):`, "Item unavailable"); if (r !== null) setOrder(o, "CANCELLED", r); }} className="rounded-xl border border-stone-700 px-3 py-2.5 text-xs font-bold text-stone-300" title="Cancel order"><Ban className="size-4" /></button>
                      <button onClick={() => setOrder(o, "PREPARING")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-sm font-extrabold text-espresso-950 hover:bg-brand-400"><CookingPot className="size-4" /> Accept & cook</button>
                    </>
                  } />
                ))}
              </Column>
              <Column title="Preparing" icon={<CookingPot className="size-4" />} tone="border-sky-500/60" count={byStatus.PREPARING.length} empty="Nothing cooking">
                {byStatus.PREPARING.map((o) => (
                  <Ticket key={o.id} o={o} now={now} accent="border-sky-500" actions={
                    <button onClick={() => setOrder(o, "READY")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-500 py-2.5 text-sm font-extrabold text-espresso-950 hover:bg-sky-400"><BellRing className="size-4" /> Mark ready</button>
                  } />
                ))}
              </Column>
              <Column title="Ready to serve" icon={<UtensilsCrossed className="size-4" />} tone="border-emerald-500/60" count={byStatus.READY.length} empty="Nothing waiting">
                {byStatus.READY.map((o) => (
                  <Ticket key={o.id} o={o} now={now} accent="border-emerald-500" actions={
                    <button onClick={() => setOrder(o, "SERVED")} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-extrabold text-espresso-950 hover:bg-emerald-400"><Check className="size-4" /> Served to table</button>
                  } />
                ))}
              </Column>
            </div>

            {byStatus.SERVED.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Served in the last 20 minutes</h3>
                <div className="flex flex-wrap gap-2">
                  {byStatus.SERVED.map((o) => (
                    <span key={o.id} className="rounded-lg border border-stone-800 bg-espresso-900 px-2.5 py-1.5 text-xs text-stone-400">
                      #{o.orderNo} · T{pad(o.table.number)} · {o.servedAt && clockTime(o.servedAt)}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tab === "floor" && <FloorMap floor={data.floor} onOpen={setBillTable} />}
        {tab === "menu" && <SoldOutBoard />}
      </main>
    </div>
    <BillPanel table={selectedTable} cafeName={data.cafeName} gstRateBp={data.gstRateBp} onClose={() => setBillTable(null)} onDone={() => { setBillTable(null); live.mutate(); }} />
    </>
  );
}

function TopTab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button onClick={onClick} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:flex-none sm:text-sm", active ? "bg-brand-500 text-espresso-950" : "text-stone-300 hover:text-white")}>
      {icon} {label}
      {!!count && <span className={cn("rounded-full px-1.5 text-[10px] font-black", active ? "bg-espresso-950 text-brand-400" : "bg-rose-600 text-white")}>{count}</span>}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-espresso-900 px-4 py-3">
      <div className={cn("font-display text-2xl font-black tabular-nums", tone)}>{value}</div>
      <div className="text-[11px] font-semibold text-stone-400">{label}</div>
    </div>
  );
}

function Column({ title, icon, tone, count, empty, children }: { title: string; icon: React.ReactNode; tone: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border-t-4 bg-espresso-900/60 p-3", tone)}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
        {icon} {title} <span className="rounded-full bg-espresso-800 px-2 text-xs text-stone-300">{count}</span>
      </h2>
      <div className="space-y-3">{count === 0 ? <p className="rounded-xl border border-dashed border-stone-800 py-8 text-center text-xs text-stone-500">{empty}</p> : children}</div>
    </section>
  );
}

function Ticket({ o, now, accent, actions }: { o: LiveOrder; now: number; accent: string; actions: React.ReactNode }) {
  const mins = minutesSince(o.createdAt, now);
  const late = mins >= 20 ? "bg-rose-500 text-white" : mins >= 10 ? "bg-brand-500/20 text-brand-300" : "bg-espresso-800 text-stone-300";
  return (
    <article className={cn("rounded-2xl border-2 bg-espresso-900 p-3.5 shadow-lg animate-pop", accent)}>
      <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-brand-500/20 px-2.5 py-1 font-display text-base font-black text-brand-300">T{pad(o.table.number)}</span>
          <span className="text-xs font-bold text-stone-400">#{o.orderNo}</span>
          {o.customerName && <span className="truncate text-xs text-stone-400">· {o.customerName}</span>}
        </div>
        <span className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums", late)}>
          <Clock className="size-3" /> {mins}m
        </span>
      </div>
      <ul className="my-3 space-y-1.5">
        {o.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-2 text-[15px] font-semibold text-white">
            <span>{i.name}</span>
            <span className="shrink-0 rounded bg-espresso-950 px-2 py-0.5 text-sm font-black text-brand-400">×{i.qty}</span>
          </li>
        ))}
      </ul>
      {o.notes && (
        <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/10 p-2.5 text-xs text-brand-100">
          <b className="text-brand-400">Note:</b> {o.notes}
        </div>
      )}
      <div className="flex gap-2">{actions}</div>
    </article>
  );
}

const FLOOR_STYLE: Record<FloorTable["status"], { box: string; label: string }> = {
  vacant: { box: "border-stone-800 bg-espresso-950 text-stone-400", label: "Vacant" },
  online: { box: "border-indigo-500/50 bg-indigo-500/10 text-indigo-300", label: "Browsing menu" },
  seated: { box: "border-brand-500/40 bg-brand-500/5 text-brand-200", label: "Dining" },
  food: { box: "border-brand-500/70 bg-brand-500/15 text-brand-300", label: "Order in kitchen" },
  attention: { box: "border-rose-500 bg-rose-500/15 text-rose-300 animate-pulse-ring", label: "Needs staff" },
};

function FloorMap({ floor, onOpen }: { floor: FloorTable[]; onOpen: (id: number) => void }) {
  const open = floor.filter((t) => t.bill);
  const openTotal = open.reduce((s, t) => s + (t.bill?.totalPaise ?? 0), 0);
  return (
    <section className="rounded-2xl border border-stone-800 bg-espresso-900 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-white">Cafe floor</h2>
        <div className="text-xs text-stone-400">
          {open.length} open bill{open.length === 1 ? "" : "s"} · <b className="text-brand-400">{formatINR(openTotal)}</b> to collect
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-stone-400">
        {Object.values(FLOOR_STYLE).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5"><span className={cn("size-3 rounded border", s.box.replace("animate-pulse-ring", ""))} /> {s.label}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {floor.map((t) => {
          const st = FLOOR_STYLE[t.status];
          return (
            <button
              key={t.id}
              onClick={() => t.bill && onOpen(t.id)}
              className={cn("rounded-2xl border p-3 text-center transition", st.box, t.bill ? "cursor-pointer hover:scale-[1.02]" : "cursor-default")}
            >
              <div className="text-[10px] font-bold opacity-75">TABLE</div>
              <div className="font-display text-2xl font-black text-white">{pad(t.number)}</div>
              <div className="truncate text-[11px] font-semibold">{st.label}</div>
              {t.bill ? <div className="mt-1.5 rounded-lg bg-espresso-950/70 py-1 text-xs font-extrabold text-brand-300">{formatINR(t.bill.totalPaise)} · Bill</div> : <div className="mt-1.5 py-1 text-xs opacity-60">{t.seats} seats</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BillPanel({ table, cafeName, gstRateBp, onClose, onDone }: { table: FloorTable | null; cafeName: string; gstRateBp: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const bill = table?.bill;
  const pending = bill?.orders.filter((o) => o.status === "PLACED") ?? [];

  async function settle(method: "CASH" | "UPI" | "CARD") {
    if (!bill || !table) return;
    if (!confirm(`Close bill #${bill.billNo} for Table ${pad(table.number)} — ${formatINR(bill.totalPaise)} paid by ${method}?`)) return;
    setBusy(method);
    try {
      await api(`/api/staff/bills/${bill.id}/settle`, "POST", { method });
      toast(`Bill #${bill.billNo} closed`, { body: `${formatINR(bill.totalPaise)} via ${method}. Table ${pad(table.number)} is free.` });
      onDone();
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const half = Math.floor((bill?.taxPaise ?? 0) / 2);
  const lines = new Map<string, { qty: number; total: number }>();
  bill?.orders.forEach((o) => o.items.forEach((i) => {
    const l = lines.get(i.name) ?? { qty: 0, total: 0 };
    lines.set(i.name, { qty: l.qty + i.qty, total: l.total + i.lineTotalPaise });
  }));

  return (
    <>
      <div className="no-print">
      <Sheet
        dark
        open={!!bill}
        onClose={onClose}
        title={table ? `Table ${pad(table.number)} · Bill #${bill?.billNo}` : ""}
        subtitle={bill ? `Opened ${clockTime(bill.openedAt)} · ${bill.orders.length} order(s)` : ""}
        icon={<div className="grid size-10 place-items-center rounded-xl bg-brand-500/15 text-brand-400"><ReceiptText className="size-5" /></div>}
        footer={bill && (
          <div className="space-y-2">
            {pending.length > 0 && <p className="rounded-lg bg-brand-500/10 p-2 text-xs text-brand-200">Order {pending.map((o) => `#${o.orderNo}`).join(", ")} is still waiting to be accepted — accept or cancel it before closing the bill.</p>}
            <div className="grid grid-cols-3 gap-2">
              {([["CASH", Banknote], ["UPI", Smartphone], ["CARD", CreditCard]] as const).map(([m, Icon]) => (
                <button key={m} disabled={!!busy || pending.length > 0} onClick={() => settle(m)} className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-espresso-950 hover:bg-emerald-400 disabled:opacity-40">
                  {busy === m ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />} Paid · {m}
                </button>
              ))}
            </div>
            <button onClick={() => window.print()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-700 py-2.5 text-xs font-bold text-stone-300">
              <Printer className="size-4" /> Print bill
            </button>
          </div>
        )}
      >
        {bill && (
          <div className="space-y-1.5 text-sm">
            {[...lines.entries()].map(([name, l]) => (
              <div key={name} className="flex justify-between gap-2"><span>{l.qty} × {name}</span><span className="tabular-nums">{formatINR(l.total)}</span></div>
            ))}
            <div className="mt-3 space-y-1 border-t border-stone-800 pt-3 text-xs text-stone-400">
              <div className="flex justify-between"><span>Item total</span><span>{formatINR(bill.subtotalPaise)}</span></div>
              {gstRateBp > 0 && <div className="flex justify-between"><span>GST (CGST {formatINR(half)} + SGST {formatINR(bill.taxPaise - half)})</span><span>{formatINR(bill.taxPaise)}</span></div>}
              <div className="flex justify-between pt-1 text-lg font-extrabold text-brand-400"><span>Total</span><span>{formatINR(bill.totalPaise)}</span></div>
            </div>
          </div>
        )}
      </Sheet>
      </div>
      {/* printable receipt (only visible when printing) */}
      {bill && table && (
        <div className="print-receipt hidden">
          <div style={{ fontFamily: "monospace", width: "72mm", fontSize: 12, color: "#000" }}>
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15 }}>{cafeName}</div>
            <div style={{ textAlign: "center" }}>Bill #{bill.billNo} · Table {pad(table.number)}</div>
            <div style={{ textAlign: "center" }}>{new Date().toLocaleString("en-IN")}</div>
            <hr />
            {[...lines.entries()].map(([name, l]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between" }}><span>{l.qty} x {name}</span><span>{(l.total / 100).toFixed(2)}</span></div>
            ))}
            <hr />
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{(bill.subtotalPaise / 100).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>CGST</span><span>{(half / 100).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>SGST</span><span>{((bill.taxPaise - half) / 100).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}><span>TOTAL ₹</span><span>{(bill.totalPaise / 100).toFixed(2)}</span></div>
            <hr />
            <div style={{ textAlign: "center" }}>Thank you! Visit again ☕</div>
          </div>
        </div>
      )}
    </>
  );
}

function SoldOutBoard() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ items: { id: string; name: string; emoji: string; available: boolean; category: { name: string } }[] }>("/api/staff/menu", fetcher);
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-espresso-900" />;
  const groups = new Map<string, typeof data.items>();
  data.items.forEach((i) => groups.set(i.category.name, [...(groups.get(i.category.name) ?? []), i]));

  async function toggle(id: string, available: boolean) {
    mutate({ items: data!.items.map((i) => (i.id === id ? { ...i, available } : i)) }, false);
    try {
      await api(`/api/staff/menu/${id}`, "PATCH", { available });
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    }
    mutate();
  }

  return (
    <section className="rounded-2xl border border-stone-800 bg-espresso-900 p-4">
      <h2 className="font-display text-base font-bold text-white">Sold out today?</h2>
      <p className="mb-4 text-xs text-stone-400">Switch a dish off and customers instantly see it as “Sold out”. Switch it back on when it&apos;s available.</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[...groups.entries()].map(([cat, items]) => (
          <div key={cat}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">{cat}</h3>
            <div className="space-y-1.5">
              {items.map((i) => (
                <button key={i.id} onClick={() => toggle(i.id, !i.available)} className={cn("flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition", i.available ? "border-stone-800 bg-espresso-950 text-white" : "border-rose-500/50 bg-rose-500/10 text-rose-200")}>
                  <span className="truncate">{i.emoji} {i.name}</span>
                  <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black", i.available ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500 text-white")}>
                    {i.available ? <><Check className="size-3" /> ON</> : <><X className="size-3" /> SOLD OUT</>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
