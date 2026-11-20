"use client";

import { useSyncExternalStore, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Armchair, BellRing, Gamepad2, Leaf, Loader2, ReceiptText, RefreshCw } from "lucide-react";
import { cn, fetcher } from "@/lib/client";
import { usePersistentState } from "@/lib/use-persistent";

type Data = {
  cafe: { name: string; tagline: string; pureVeg: boolean; acceptingOrders: boolean };
  tables: { number: number; label: string | null; code: string }[];
};
type Last = { code: string; number: number; at: number } | null;

const pad = (n: number) => String(n).padStart(2, "0");
const REMEMBER_MS = 12 * 60 * 60 * 1000; // a chosen table is remembered for 12 hours

// current time as an external store (minute resolution) — safe for static prerender
let nowCache = 0;
function subscribeNow(cb: () => void) {
  const t = setInterval(() => { nowCache = Date.now(); cb(); }, 60_000);
  return () => clearInterval(t);
}
/** called only from click handlers */
function timestamp() {
  return Date.now();
}
function getNow() {
  if (!nowCache) nowCache = Date.now();
  return nowCache;
}

/**
 * Home screen.
 * Step 1 — "Which table are you at?" (table number grid).
 * Step 2 — cafe home for that table: Order & pay · Call waiter · Play games.
 */
export function TablePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error } = useSWR<Data>("/api/tables", fetcher);
  const [last, setLast] = usePersistentState<Last>("cc:last-table", null);
  const now = useSyncExternalStore(subscribeNow, getNow, () => 0);
  const forceChange = params.get("change") === "1"; // from the "change" link on a table page
  const [changing, setChanging] = useState(false);
  const [going, setGoing] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState("");

  if (error) {
    return <Center><p className="text-sm text-ink-2">Can&apos;t connect right now. Please check your internet and try again.</p></Center>;
  }
  if (!data) return <Center><Loader2 className="size-7 animate-spin text-brand-600" /></Center>;

  const current = last && now - last.at < REMEMBER_MS ? data.tables.find((t) => t.code === last.code) ?? null : null;
  const showHub = !!current && !changing && !forceChange;
  const backToHub = () => {
    setChanging(false);
    if (forceChange) router.replace("/");
  };

  function choose(number: number) {
    const t = data!.tables.find((x) => x.number === number);
    if (!t) {
      setTypedError(`There's no table ${number}. Please check the number on your table.`);
      return;
    }
    setTypedError("");
    setLast({ code: t.code, number: t.number, at: timestamp() });
    backToHub();
  }

  function go(where: "menu" | "waiter" | "games") {
    if (!current) return;
    setGoing(where);
    const q = where === "waiter" ? "?open=waiter" : where === "games" ? "?tab=games" : "";
    router.push(`/t/${current.code}${q}`);
    // reset once we're away, in case the guest comes back with the browser's back button
    setTimeout(() => setGoing(null), 4000);
  }

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto size-80 rounded-full bg-brand-400/15 blur-3xl" />

      {/* brand */}
      <div className="relative text-center animate-pop">
        <div className="mx-auto grid size-20 rotate-[-6deg] place-items-center rounded-[26px] bg-gradient-to-br from-brand-400 to-brand-700 text-4xl shadow-brand animate-float">☕</div>
        <h1 className="mt-6 font-serif text-[34px] font-semibold leading-tight text-ink sm:text-4xl">{data.cafe.name}</h1>
        {data.cafe.tagline && (
          <p className="mt-1.5 flex items-center justify-center gap-1 text-sm text-ink-2 sm:text-base">
            {data.cafe.pureVeg && <Leaf className="size-3.5 text-emerald-700" />} {data.cafe.tagline}
          </p>
        )}
      </div>

      {showHub ? (
        /* ---------- step 2: cafe home for the chosen table ---------- */
        <section key="hub" className="relative mt-10 rounded-[28px] bg-white p-5 shadow-lift ring-1 ring-line/70 animate-slide-up">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-center shadow-brand">
                <span className="font-display text-xl font-extrabold text-white">{pad(current!.number)}</span>
              </span>
              <div className="text-left">
                <div className="text-xs text-ink-2">Welcome to</div>
                <div className="font-serif text-xl font-semibold text-ink">Table {pad(current!.number)}</div>
              </div>
            </div>
            <button onClick={() => setChanging(true)} className="press flex items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-sand-2 hover:text-ink">
              <RefreshCw className="size-3" /> Change table
            </button>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-3">
            Browse the menu, order straight to the kitchen, call a waiter and play games with your friends while you wait.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <HubButton onClick={() => go("menu")} busy={going === "menu"} icon={<ReceiptText className="size-6" />} label="Order & pay" tone="bg-brand-50 text-brand-600" i={0} />
            <HubButton onClick={() => go("waiter")} busy={going === "waiter"} icon={<BellRing className="size-6" />} label="Call waiter" tone="bg-rose-50 text-rose-600" i={1} />
            <HubButton onClick={() => go("games")} busy={going === "games"} icon={<Gamepad2 className="size-6" />} label="Play games" tone="bg-indigo-50 text-indigo-600" i={2} />
          </div>
        </section>
      ) : (
        /* ---------- step 1: which table? ---------- */
        <section key="pick" className="relative mt-10 rounded-[28px] bg-white p-5 shadow-lift ring-1 ring-line/70 animate-slide-up">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Armchair className="size-5" /></span>
            <div>
              <h2 className="font-serif text-xl font-semibold leading-snug text-ink">Welcome! Which table are you at?</h2>
              <p className="text-xs text-ink-3">You&apos;ll find the number on your table.</p>
            </div>
          </div>

          {data.tables.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-line-2 p-4 text-center text-sm text-ink-2">No tables are set up yet. Please ask the staff.</p>
          ) : (
            <>
              <div className={cn("mt-5 grid gap-2.5", data.tables.length > 24 ? "grid-cols-5" : "grid-cols-4")}>
                {data.tables.map((t) => (
                  <button
                    key={t.number}
                    onClick={() => choose(t.number)}
                    aria-label={`Table ${t.number}${t.label ? `, ${t.label}` : ""}`}
                    style={{ "--i": t.number } as React.CSSProperties}
                    className={cn(
                      "stagger press flex aspect-square flex-col items-center justify-center rounded-2xl border text-center transition",
                      current?.number === t.number
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-line bg-sand/60 text-ink hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
                    )}
                  >
                    <span className="font-display text-2xl font-extrabold leading-none">{pad(t.number)}</span>
                    {t.label && <span className="mt-1 max-w-full truncate px-1 text-[9px] font-semibold text-ink-2">{t.label}</span>}
                  </button>
                ))}
              </div>

              {data.tables.length > 24 && (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(typed);
                    if (Number.isInteger(n) && n > 0) choose(n);
                    else setTypedError("Please type your table number.");
                  }}
                >
                  <input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))} placeholder="Or type table number"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-sand px-3 py-3 text-center text-lg font-bold text-ink outline-none focus:border-brand-500" />
                  <button className="rounded-xl bg-brand-600 px-5 font-extrabold text-white">Go</button>
                </form>
              )}
              {typedError && <p className="mt-3 text-center text-sm text-rose-600">{typedError}</p>}
              {current && (
                <button type="button" onClick={backToHub} className="mt-4 w-full text-center text-xs font-semibold text-ink-2 hover:text-ink">
                  ← Back to Table {pad(current.number)}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <p className="relative mt-8 text-center text-xs text-ink-3">No app to download · Just order &amp; enjoy ☕</p>
    </main>
  );
}

function HubButton({ onClick, busy, icon, label, tone, i }: { onClick: () => void; busy: boolean; icon: React.ReactNode; label: string; tone: string; i: number }) {
  return (
    <button
      onClick={onClick}
      style={{ "--i": i + 2 } as React.CSSProperties}
      className="stagger press group flex flex-col items-center gap-2.5 rounded-2xl bg-white px-1 py-4 text-[13px] font-bold text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-card hover:ring-brand-200"
    >
      <span className={cn("grid size-12 place-items-center rounded-2xl transition group-hover:scale-110", tone)}>{busy ? <Loader2 className="size-6 animate-spin" /> : icon}</span>
      {label}
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="grid flex-1 place-items-center px-6 text-center">{children}</main>;
}
