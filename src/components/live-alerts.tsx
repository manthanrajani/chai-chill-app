"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BellRing, Check, ChefHat, GlassWater, ReceiptText, Sparkles, UserRound, Volume2, VolumeX, X, MessageSquare } from "lucide-react";
import { api, cn, fetcher, minutesSince, useNow } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { chime, unlockAudio } from "@/lib/sound";
import { usePersistentState } from "@/lib/use-persistent";

type Req = { id: string; type: "WAITER" | "WATER" | "CLEAN" | "BILL" | "CUSTOM"; message: string; createdAt: string; table: { number: number } };
type Ord = { id: string; orderNo: number; status: string; totalPaise: number; createdAt: string; table: { number: number }; items: { name: string; qty: number }[] };
type Live = { requests: Req[]; orders: Ord[] };

const pad = (n: number) => String(n).padStart(2, "0");
const ICON = { WAITER: UserRound, WATER: GlassWater, CLEAN: Sparkles, BILL: ReceiptText, CUSTOM: MessageSquare };
const TITLE = { WAITER: "is calling a waiter", WATER: "needs water", CLEAN: "wants the table cleaned", BILL: "wants the bill", CUSTOM: "has a request" };
const RING_EVERY_MS = 20_000;

/**
 * Owner-side live alerts: when a table taps "Call waiter" (or water / bill / clean),
 * a ringing alert card appears on every admin page until someone marks it done.
 * New orders show a short pop-up too. Optional desktop notifications for when the tab is in the background.
 */
export function LiveAlerts() {
  const [sound, setSound] = usePersistentState<boolean>("cc:owner-sound", false);
  const [snoozed, setSnoozed] = useState<string[]>([]);
  const [newOrders, setNewOrders] = useState<Ord[]>([]);
  const now = useNow(10_000);
  const known = useRef<{ req: Set<string>; ord: Set<string> } | null>(null);
  const lastRing = useRef(0);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  // detect new requests / orders on every poll → ring + desktop notification
  function onData(d: Live) {
    const placed = d.orders.filter((o) => o.status === "PLACED");
    const prev = known.current;
    known.current = { req: new Set(d.requests.map((r) => r.id)), ord: new Set(placed.map((o) => o.id)) };
    if (!prev) return; // first load: don't ring for old requests
    const freshReq = d.requests.filter((r) => !prev.req.has(r.id));
    const freshOrd = placed.filter((o) => !prev.ord.has(o.id));
    if (freshReq.length) {
      if (soundRef.current) { chime("alert"); lastRing.current = Date.now(); }
      freshReq.forEach((r) => notify(`🔔 Table ${pad(r.table.number)} ${TITLE[r.type]}`, r.message));
    }
    if (freshOrd.length) {
      if (soundRef.current && !freshReq.length) chime("order");
      freshOrd.forEach((o) => notify(`🧾 New order #${o.orderNo} — Table ${pad(o.table.number)}`, o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")));
      setNewOrders((cur) => [...freshOrd, ...cur].slice(0, 3));
      freshOrd.forEach((o) => setTimeout(() => setNewOrders((cur) => cur.filter((x) => x.id !== o.id)), 12_000));
    }
  }
  const { data, mutate } = useSWR<Live>("/api/staff/live", fetcher, { refreshInterval: 3000, revalidateOnFocus: true, onSuccess: onData });

  // browsers only allow sound after a click — unlock on the first interaction anywhere
  useEffect(() => {
    if (!sound) return;
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [sound]);

  const requests = data?.requests ?? [];
  const visible = requests.filter((r) => !snoozed.includes(r.id));

  // keep ringing gently while a table is still waiting
  useEffect(() => {
    if (!sound || !visible.length) return;
    const t = setInterval(() => {
      if (Date.now() - lastRing.current >= RING_EVERY_MS - 500) { chime("alert"); lastRing.current = Date.now(); }
    }, RING_EVERY_MS);
    return () => clearInterval(t);
  }, [sound, visible.length]);

  // flash the browser tab title so it's noticeable even on another tab
  useEffect(() => {
    if (!visible.length) return;
    const base = document.title.replace(/^🔔 .*? · /, "");
    const msg = `🔔 Table ${pad(visible[0].table.number)}${visible.length > 1 ? ` +${visible.length - 1}` : ""} · `;
    let on = true;
    const t = setInterval(() => { document.title = on ? msg + base : base; on = !on; }, 1000);
    return () => { clearInterval(t); document.title = base; };
  }, [visible]);

  async function enableSound() {
    unlockAudio();
    setSound(true);
    chime("alert");
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
  }

  async function resolve(id: string) {
    mutate((d) => d && { ...d, requests: d.requests.filter((r) => r.id !== id) }, false);
    try { await api(`/api/staff/requests/${id}`, "PATCH"); } catch {}
    mutate();
  }

  return (
    <div className="no-print pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]">
      {/* new orders (auto-hide) */}
      {newOrders.map((o) => (
        <div key={o.id} className="pointer-events-auto w-full rounded-2xl border border-brand-400/60 bg-espresso-900 p-3 text-stone-100 shadow-2xl animate-slide-up">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-espresso-950"><ChefHat className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-brand-300">New order #{o.orderNo} · Table {pad(o.table.number)}</div>
              <div className="truncate text-xs text-stone-300">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
              <div className="mt-0.5 text-xs font-bold text-stone-200">{formatINR(o.totalPaise)}</div>
            </div>
            <button onClick={() => setNewOrders((c) => c.filter((x) => x.id !== o.id))} aria-label="Dismiss" className="text-stone-400 hover:text-white"><X className="size-4" /></button>
          </div>
        </div>
      ))}

      {/* waiter calls (stay until done) */}
      {visible.slice(0, 4).map((r) => {
        const Icon = ICON[r.type];
        const age = minutesSince(r.createdAt, now);
        return (
          <div key={r.id} role="alert" className="pointer-events-auto w-full overflow-hidden rounded-2xl border-2 border-rose-500 bg-espresso-950 text-stone-100 shadow-2xl shadow-rose-900/40 animate-pop">
            <div className="flex items-center gap-3 bg-rose-500/15 p-3">
              <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-500 text-white">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-rose-500 opacity-40" />
                <BellRing className="relative size-6 animate-bounce" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-xl font-black leading-none text-white">Table {pad(r.table.number)}</div>
                <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-rose-200"><Icon className="size-3.5 shrink-0" /> <span className="truncate">{r.message}</span></div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", age >= 3 ? "bg-rose-500 text-white" : "bg-espresso-800 text-stone-300")}>
                {age ? `${age} min` : "now"}
              </span>
            </div>
            <div className="flex gap-2 p-2">
              <button onClick={() => setSnoozed((s) => [...s, r.id])} className="rounded-xl px-3 py-2 text-xs font-bold text-stone-400 hover:text-white">Hide</button>
              <button onClick={() => resolve(r.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-sm font-extrabold text-espresso-950 hover:bg-emerald-400">
                <Check className="size-4" /> Done — staff attended
              </button>
            </div>
          </div>
        );
      })}
      {visible.length > 4 && (
        <Link href="/kitchen" className="pointer-events-auto rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-lg">+{visible.length - 4} more table requests → open kitchen screen</Link>
      )}

      {/* sound switch */}
      <button
        onClick={() => (sound ? setSound(false) : enableSound())}
        className={cn(
          "pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg",
          sound ? "bg-espresso-900 text-emerald-300" : "animate-pulse bg-rose-600 text-white",
        )}
        title={sound ? "Bell sound is on" : "Turn on the bell sound"}
      >
        {sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
        {sound ? "Table bell on" : "Tap to turn on table bell 🔔"}
      </button>
    </div>
  );
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
    new Notification(title, { body, icon: "/icon.svg", tag: title });
  } catch {}
}
