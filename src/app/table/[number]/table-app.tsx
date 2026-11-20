"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { BellRing, BookOpen, ChevronDown, ChevronRight, Gamepad2, Leaf, ReceiptText, Wifi, CircleCheck, PauseCircle, ClipboardList } from "lucide-react";
import { fetcher, HttpError, cn } from "@/lib/client";
import { formatINR, computeTax } from "@/lib/money";
import { chime, unlockAudio } from "@/lib/sound";
import { useToast } from "@/components/toast";
import type { Cart, MenuResponse, TableResponse } from "./types";
import { MenuView } from "./menu";
import { CartSheet } from "./cart";
import { OrdersStrip, OrdersTab, BillSheet } from "./orders";
import { WaiterSheet, WifiSheet } from "./service";
import { GamesZone, IncomingWatcher } from "./games/zone";
import { usePersistentState } from "@/lib/use-persistent";

export type Section = "menu" | "orders" | "play" | "waiter" | "bill" | "wifi";
type Tab = "menu" | "orders" | "games";
type SheetName = null | "cart" | "bill" | "waiter" | "wifi";

/** Readable address for the current screen: /table/7, /table/7/orders, /table/7/play, /table/7/waiter … */
function pathFor(code: string, tab: Tab, sheet: SheetName) {
  if (sheet === "waiter" || sheet === "bill" || sheet === "wifi") return `/table/${code}/${sheet}`;
  if (tab === "orders") return `/table/${code}/orders`;
  if (tab === "games") return `/table/${code}/play`;
  return `/table/${code}`;
}

export function TableApp({ code, section = "menu" }: { code: string; section?: Section }) {
  const toast = useToast();
  const table = useSWR<TableResponse>(`/api/table/${code}`, fetcher, { refreshInterval: 4000, revalidateOnFocus: true });
  const menu = useSWR<MenuResponse>("/api/menu", fetcher, { refreshInterval: 60_000 });

  // the screen comes from the URL (/table/7/orders …) and the URL follows the screen
  const [tab, setTab] = useState<Tab>(section === "orders" ? "orders" : section === "play" ? "games" : "menu");
  const [sheet, setSheet] = useState<SheetName>(section === "waiter" || section === "bill" || section === "wifi" ? section : null);
  const closeSheet = useCallback(() => setSheet(null), []);
  useEffect(() => {
    const path = pathFor(code, tab, sheet);
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, "", path);
  }, [code, tab, sheet]);

  // cart survives refreshes (per table)
  const [savedCart, setCart] = usePersistentState<Cart>(`cc:cart:${code}`, {});

  const itemsById = useMemo(() => {
    const m = new Map<string, MenuResponse["categories"][number]["items"][number]>();
    menu.data?.categories?.forEach((c) => c.items?.forEach((i) => m.set(i.id, i)));
    return m;
  }, [menu.data]);

  // ignore items that vanished from the menu
  const cart = useMemo<Cart>(
    () => (menu.data ? Object.fromEntries(Object.entries(savedCart).filter(([id]) => itemsById.has(id))) : savedCart),
    [savedCart, itemsById, menu.data],
  );

  const updateCart = useCallback((id: string, delta: number) => {
    unlockAudio();
    setCart((c) => {
      const q = Math.min(20, (c[id] ?? 0) + delta);
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }, [setCart]);

  const gstRateBp = table.data?.cafe?.gstRateBp ?? menu.data?.cafe?.gstRateBp ?? 500;
  const cartSummary = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    for (const [id, qty] of Object.entries(cart)) {
      const item = itemsById.get(id);
      if (!item) continue;
      count += qty;
      subtotal += item.pricePaise * qty;
    }
    const tax = computeTax(subtotal, gstRateBp);
    return { count, subtotal, tax, total: subtotal + tax };
  }, [cart, itemsById, gstRateBp]);

  // notify the customer when the kitchen moves their order along
  const prevStatuses = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const orders = table.data?.bill?.orders ?? [];
    const prev = prevStatuses.current;
    if (prev) {
      for (const o of orders) {
        const before = prev.get(o.id);
        if (!before || before === o.status) continue;
        if (o.status === "PREPARING") toast(`Order #${o.orderNo} accepted`, { body: "The chef has started preparing it 👨‍🍳", tone: "info" });
        if (o.status === "READY") {
          toast(`Order #${o.orderNo} is ready!`, { body: "It's on its way to your table 🍽️" });
          chime("success");
          try { navigator.vibrate?.([200, 100, 200]); } catch {}
        }
        if (o.status === "CANCELLED") toast(`Order #${o.orderNo} was cancelled`, { body: "Please ask the staff if this is unexpected.", tone: "warning" });
      }
    }
    prevStatuses.current = new Map(orders.map((o) => [o.id, o.status]));
  }, [table.data, toast]);

  // remember this table on the phone, so the home page tiles can bring the guest back here
  const tableNumber = table.data?.table.number;
  useEffect(() => {
    if (!tableNumber) return;
    try { localStorage.setItem("cc:last-table", JSON.stringify({ number: tableNumber, at: Date.now() })); } catch {}
  }, [code, tableNumber]);

  // browser tab shows the cafe's own name
  const cafeName = table.data?.cafe.name;
  useEffect(() => {
    if (cafeName && tableNumber) document.title = `Table ${tableNumber} · ${cafeName}`;
  }, [cafeName, tableNumber]);

  // show "thank you" when this table's bill was just settled (and the customer hasn't dismissed it)
  const [dismissedBill, setDismissedBill] = usePersistentState<string>(`cc:thanks:${code}`, "");
  const closed = table.data?.lastClosedBill;
  const thanks = !!closed && !table.data?.bill && dismissedBill !== closed.id;
  const dismissThanks = () => closed && setDismissedBill(closed.id);

  if (table.error && !table.data?.cafe) {
    const notFound = table.error instanceof HttpError && table.error.status === 404;
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
        <div className="animate-fade-up">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-white text-4xl shadow-card">☕</div>
          <h1 className="mt-5 font-serif text-2xl font-semibold">{notFound ? "We couldn't find this table" : "Can't connect right now"}</h1>
          <p className="mt-2 text-sm text-ink-2">
            {notFound ? "Please choose your table again, or ask the staff for help." : "Check your internet / Wi-Fi — we'll keep retrying automatically."}
          </p>
          {notFound && <Link href="/tables" className="press mt-6 inline-block rounded-2xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-brand">Choose my table</Link>}
        </div>
      </div>
    );
  }
  if (!table.data?.cafe || !menu.data?.categories) return <LoadingShell />;

  const { cafe, bill, requests } = table.data;
  const tableNo = String(table.data.table.number).padStart(2, "0");
  const activeOrders = (bill?.orders ?? []).filter((o) => o.status !== "SERVED" && o.status !== "CANCELLED");
  const hour = new Date(table.data.serverTime).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const tabs = ["menu", "orders", "games"] as const;
  const tabIndex = tabs.indexOf(tab);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      {/* ---------- top app bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg shadow-brand">☕</div>
            <div className="min-w-0">
              <div className="truncate font-serif text-[17px] font-semibold leading-tight">{cafe.name}</div>
              {cafe.pureVeg && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <Leaf className="size-3" /> Pure veg
                </div>
              )}
            </div>
          </div>
          <Link href="/tables" title="Change table" className="press flex shrink-0 items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 shadow-card">
            <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-xs font-extrabold text-white">{tableNo}</span>
            <span className="text-xs font-bold text-ink">Table</span>
            <ChevronDown className="size-3.5 text-ink-3" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-44 pt-4">
        {/* ---------- hero ---------- */}
        {tab === "menu" && (
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-5 text-white shadow-brand animate-fade-up">
            <div className="pointer-events-none absolute -right-6 -top-8 text-[110px] leading-none opacity-15 animate-float" aria-hidden>☕</div>
            <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-white/10 blur-2xl" />
            <p className="relative text-sm font-medium text-white/80">{greeting} 👋</p>
            <h1 className="relative mt-1 max-w-[16rem] font-serif text-[26px] font-semibold leading-tight">What would you like today?</h1>
            <div className="relative mt-5 grid grid-cols-3 gap-2.5">
              <HeroAction onClick={() => setSheet("wifi")} icon={<Wifi className="size-5" />} label="Wi-Fi" />
              <HeroAction onClick={() => setSheet("waiter")} icon={<BellRing className="size-5" />} label={requests.length ? "Notified ✓" : "Call waiter"} badge={requests.length || undefined} />
              <HeroAction onClick={() => (bill ? setSheet("bill") : setTab("orders"))} icon={<ReceiptText className="size-5" />} label={bill ? formatINR(bill.totalPaise) : "My bill"} />
            </div>
          </section>
        )}

        {thanks && table.data.lastClosedBill && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 animate-pop">
            <CircleCheck className="size-6 shrink-0 text-emerald-600" />
            <div className="flex-1 text-sm">
              <div className="font-bold text-emerald-800">Bill paid — thank you! 🙏</div>
              <div className="text-xs text-emerald-900/70">Bill #{table.data.lastClosedBill.billNo} · {formatINR(table.data.lastClosedBill.totalPaise)}. Phir milenge!</div>
            </div>
            <button onClick={dismissThanks} className="text-xs font-bold text-emerald-800">Close</button>
          </div>
        )}

        {!cafe.acceptingOrders && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-sm">
            <PauseCircle className="size-5 shrink-0 text-brand-600" />
            <span className="text-brand-800">Online ordering is paused right now. You can still browse the menu or call the waiter.</span>
          </div>
        )}

        {tab !== "orders" && <OrdersStrip orders={bill?.orders ?? []} onOpen={() => setTab("orders")} />}

        <div className="mt-5">
          <div className={tab === "menu" ? "" : "hidden"}>
            <MenuView data={menu.data} cart={cart} onChange={updateCart} />
          </div>
          {tab === "orders" && (
            <>
              <PageTitle title="Your orders" subtitle={`Table ${tableNo} · live from the kitchen`} />
              <OrdersTab
                code={code}
                data={table.data}
                onPlay={() => setTab("games")}
                onMenu={() => setTab("menu")}
                onBill={() => setSheet("bill")}
                onRefresh={() => table.mutate()}
              />
            </>
          )}
          <div className={tab === "games" ? "" : "hidden"}>
            <PageTitle title="Play & chill" subtitle="Games while your food is being prepared" />
            <GamesZone code={code} tableId={table.data.table.id} tableNumber={table.data.table.number} visible={tab === "games"} />
          </div>
        </div>
        {/* incoming challenges should pop up even while browsing the menu */}
        {tab !== "games" && <IncomingWatcher code={code} onOpen={() => setTab("games")} />}
      </main>

      {/* ---------- floating cart + bottom navigation ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-xl px-3">
          {cartSummary.count > 0 && (
            <button
              key={cartSummary.count}
              onClick={() => setSheet("cart")}
              className="press mb-2 flex w-full items-center justify-between rounded-2xl bg-ink p-3 pl-3.5 text-white shadow-lift animate-bump"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-500 text-sm font-extrabold">{cartSummary.count}</span>
                <div className="text-left">
                  <div className="text-[11px] font-medium leading-none text-white/60">{cartSummary.count} item{cartSummary.count > 1 ? "s" : ""} · Table {tableNo}</div>
                  <div className="mt-1 text-sm font-bold leading-tight">View cart</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-extrabold">
                {formatINR(cartSummary.total)} <ChevronRight className="size-4" />
              </div>
            </button>
          )}
          <nav className="relative mb-2 grid grid-cols-3 rounded-[22px] border border-line bg-white/90 p-1.5 shadow-lift backdrop-blur-xl" aria-label="Sections">
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-1.5 rounded-2xl bg-brand-50 ring-1 ring-brand-200 transition-transform duration-300 ease-[var(--ease-spring)]"
              style={{ width: "calc((100% - 0.75rem) / 3)", transform: `translateX(${tabIndex * 100}%)` }}
            />
            <NavButton active={tab === "menu"} onClick={() => setTab("menu")} icon={<BookOpen className="size-5" />} label="Menu" />
            <NavButton active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="size-5" />} label="Orders" badge={activeOrders.length || undefined} />
            <NavButton active={tab === "games"} onClick={() => setTab("games")} icon={<Gamepad2 className="size-5" />} label="Play" />
          </nav>
        </div>
      </div>

      <CartSheet
        open={sheet === "cart"}
        onClose={closeSheet}
        code={code}
        cart={cart}
        itemsById={itemsById}
        summary={cartSummary}
        gstRateBp={gstRateBp}
        acceptingOrders={cafe.acceptingOrders}
        onChange={updateCart}
        onPlaced={(orderNo) => {
          setCart({});
          setSheet(null);
          setTab("orders");
          window.scrollTo({ top: 0, behavior: "smooth" });
          chime("success");
          toast(`Order #${orderNo} sent to the kitchen!`, { body: "We'll update you here as it's prepared." });
          table.mutate();
        }}
        onMenuStale={() => menu.mutate()}
      />
      <BillSheet open={sheet === "bill"} onClose={closeSheet} code={code} data={table.data} onRefresh={() => table.mutate()} />
      <WaiterSheet open={sheet === "waiter"} onClose={closeSheet} code={code} tableNo={tableNo} requests={requests} onSent={() => table.mutate()} />
      <WifiSheet open={sheet === "wifi"} onClose={closeSheet} ssid={cafe.wifiSsid} password={cafe.wifiPassword} />
    </div>
  );
}

function HeroAction({ onClick, icon, label, badge }: { onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className="press relative flex flex-col items-center gap-1.5 rounded-2xl bg-white/12 px-1 py-3 text-xs font-semibold ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20">
      <span className="grid size-10 place-items-center rounded-full bg-white text-brand-600 shadow">{icon}</span>
      <span className="max-w-full truncate">{label}</span>
      {badge ? <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-brand-600">{badge}</span> : null}
    </button>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn("press relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition-colors", active ? "text-brand-700" : "text-ink-3 hover:text-ink")}
    >
      <span className="relative">
        {icon}
        {badge ? <span className="absolute -right-2.5 -top-1.5 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white">{badge}</span> : null}
      </span>
      {label}
    </button>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 animate-fade-up">
      <h2 className="font-serif text-[26px] font-semibold leading-tight">{title}</h2>
      <p className="text-sm text-ink-3">{subtitle}</p>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4 pt-16">
      <div className="skeleton h-44 rounded-[28px]" />
      <div className="skeleton h-11 rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-32 rounded-3xl" />
      ))}
    </div>
  );
}
