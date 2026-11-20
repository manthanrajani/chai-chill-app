"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { BellRing, BookOpen, ChevronRight, Gamepad2, Leaf, ReceiptText, Wifi, CircleCheck, PauseCircle, ClipboardList } from "lucide-react";
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

export function TableApp({ code }: { code: string }) {
  const toast = useToast();
  const table = useSWR<TableResponse>(`/api/t/${code}`, fetcher, { refreshInterval: 4000, revalidateOnFocus: true });
  const menu = useSWR<MenuResponse>("/api/menu", fetcher, { refreshInterval: 60_000 });

  // deep links: /t/<code>?tab=orders|games  and  ?open=waiter|wifi|bill
  const params = useSearchParams();
  const [tab, setTab] = useState<"menu" | "orders" | "games">(() => {
    const t = params.get("tab");
    return t === "orders" || t === "games" ? t : "menu";
  });
  const [sheet, setSheet] = useState<null | "cart" | "bill" | "waiter" | "wifi">(() => {
    const o = params.get("open");
    return o === "waiter" || o === "wifi" || o === "bill" ? o : null;
  });
  const closeSheet = useCallback(() => setSheet(null), []);

  // cart survives refreshes (per table)
  const [savedCart, setCart] = usePersistentState<Cart>(`cc:cart:${code}`, {});

  const itemsById = useMemo(() => {
    const m = new Map<string, MenuResponse["categories"][number]["items"][number]>();
    menu.data?.categories.forEach((c) => c.items.forEach((i) => m.set(i.id, i)));
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

  const gstRateBp = table.data?.cafe.gstRateBp ?? menu.data?.cafe.gstRateBp ?? 500;
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
    try { localStorage.setItem("cc:last-table", JSON.stringify({ code, number: tableNumber, at: Date.now() })); } catch {}
  }, [code, tableNumber]);

  // show "thank you" when this table's bill was just settled (and the customer hasn't dismissed it)
  const [dismissedBill, setDismissedBill] = usePersistentState<string>(`cc:thanks:${code}`, "");
  const closed = table.data?.lastClosedBill;
  const thanks = !!closed && !table.data?.bill && dismissedBill !== closed.id;
  const dismissThanks = () => closed && setDismissedBill(closed.id);

  if (table.error) {
    const notFound = table.error instanceof HttpError && table.error.status === 404;
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
        <div>
          <div className="mb-4 text-5xl">☕</div>
          <h1 className="font-display text-xl font-extrabold">{notFound ? "Table not found" : "Can't connect right now"}</h1>
          <p className="mt-2 text-sm text-stone-400">
            {notFound ? "This QR code isn't active. Please scan the QR on your table again or ask the staff." : "Check your internet / Wi-Fi and we'll retry automatically."}
          </p>
        </div>
      </div>
    );
  }
  if (!table.data || !menu.data) return <LoadingShell />;

  const { cafe, bill, requests } = table.data;
  const tableNo = String(table.data.table.number).padStart(2, "0");
  const activeOrders = (bill?.orders ?? []).filter((o) => o.status !== "SERVED" && o.status !== "CANCELLED");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-3 pb-32 pt-3 sm:px-4">
      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-espresso-800 via-espresso-900 to-espresso-900 p-4 shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-2xl shadow-lg">☕</div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-extrabold leading-tight text-white sm:text-xl">{cafe.name}</h1>
              <p className="mt-0.5 flex items-start gap-1 text-xs font-semibold leading-snug text-emerald-400">
                {cafe.pureVeg && <Leaf className="mt-0.5 size-3 shrink-0" />} <span>{cafe.tagline}</span>
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Table</div>
            <div className="font-display text-xl font-black leading-none text-amber-400">{tableNo}</div>
          </div>
        </div>

        <div className={cn("relative mt-4 grid gap-2", bill ? "grid-cols-3" : "grid-cols-2")}>
          <QuickAction onClick={() => setSheet("wifi")} icon={<Wifi className="size-4" />} label="Free Wi-Fi" tone="sky" />
          <QuickAction
            onClick={() => setSheet("waiter")}
            icon={<BellRing className="size-4" />}
            label={requests.length ? "Notified ✓" : "Call waiter"}
            tone="rose"
            badge={requests.length || undefined}
          />
          {bill && <QuickAction onClick={() => setSheet("bill")} icon={<ReceiptText className="size-4" />} label={formatINR(bill.totalPaise)} tone="amber" />}
        </div>
      </header>

      {thanks && table.data.lastClosedBill && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 animate-pop">
          <CircleCheck className="size-6 shrink-0 text-emerald-400" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-emerald-300">Bill paid — thank you! 🙏</div>
            <div className="text-xs text-stone-300">Bill #{table.data.lastClosedBill.billNo} · {formatINR(table.data.lastClosedBill.totalPaise)}. Phir milenge!</div>
          </div>
          <button onClick={dismissThanks} className="text-xs font-bold text-stone-400">Close</button>
        </div>
      )}

      {!cafe.acceptingOrders && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <PauseCircle className="size-5 shrink-0 text-amber-400" />
          <span className="text-amber-100">Online ordering is paused right now. You can still browse the menu or call the waiter.</span>
        </div>
      )}

      {tab !== "orders" && <OrdersStrip orders={bill?.orders ?? []} onOpen={() => setTab("orders")} />}

      {/* Tabs */}
      <div className="sticky top-0 z-30 -mx-3 mt-4 bg-espresso-950/90 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-800 bg-espresso-900 p-1.5">
          <TabButton active={tab === "menu"} onClick={() => setTab("menu")} icon={<BookOpen className="size-4" />} label="Menu" />
          <TabButton
            active={tab === "orders"}
            onClick={() => setTab("orders")}
            icon={<ClipboardList className="size-4" />}
            label="Orders"
            pill={activeOrders.length ? <span className="grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-black text-white">{activeOrders.length}</span> : undefined}
            alwaysPill
          />
          <TabButton
            active={tab === "games"}
            onClick={() => setTab("games")}
            icon={<Gamepad2 className="size-4" />}
            label="Play"
          />
        </div>
      </div>

      <div className={tab === "menu" ? "" : "hidden"}>
        <MenuView data={menu.data} cart={cart} onChange={updateCart} />
      </div>
      {tab === "orders" && (
        <OrdersTab
          code={code}
          data={table.data}
          onPlay={() => setTab("games")}
          onMenu={() => setTab("menu")}
          onBill={() => setSheet("bill")}
          onRefresh={() => table.mutate()}
        />
      )}
      <div className={tab === "games" ? "" : "hidden"}>
        <GamesZone code={code} tableId={table.data.table.id} tableNumber={table.data.table.number} visible={tab === "games"} />
      </div>
      {/* incoming challenges should pop up even while browsing the menu */}
      {tab !== "games" && <IncomingWatcher code={code} onOpen={() => setTab("games")} />}

      {/* Floating cart bar */}
      {cartSummary.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] animate-slide-up">
          <button
            onClick={() => setSheet("cart")}
            className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-3.5 font-extrabold text-espresso-950 shadow-2xl shadow-orange-900/40 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-espresso-950 text-sm font-black text-amber-400">{cartSummary.count}</span>
              <div className="text-left">
                <div className="text-[11px] uppercase leading-none tracking-wider opacity-75">Table {tableNo} · {cartSummary.count} item{cartSummary.count > 1 ? "s" : ""}</div>
                <div className="text-sm leading-tight sm:text-base">Review & send to kitchen</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-base font-black sm:text-lg">
              {formatINR(cartSummary.total)} <ChevronRight className="size-4" />
            </div>
          </button>
        </div>
      )}

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
    </main>
  );
}

function QuickAction({ onClick, icon, label, tone, badge }: { onClick: () => void; icon: React.ReactNode; label: string; tone: "sky" | "rose" | "amber"; badge?: number }) {
  const tones = {
    sky: "border-sky-500/30 text-sky-300 hover:bg-sky-500/10",
    rose: "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  };
  return (
    <button onClick={onClick} className={cn("relative flex items-center justify-center gap-1.5 rounded-xl border bg-espresso-950/70 px-2 py-2.5 text-xs font-bold transition active:scale-95 sm:text-sm", tones[tone])}>
      {icon}
      <span className="truncate">{label}</span>
      {badge ? <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-black text-white">{badge}</span> : null}
    </button>
  );
}

function TabButton({ active, onClick, icon, label, pill, alwaysPill }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; pill?: React.ReactNode; alwaysPill?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-[13px] font-bold transition sm:text-sm",
        active ? "bg-amber-500 text-espresso-950 shadow" : "text-stone-300 hover:text-white",
      )}
    >
      {icon}
      {label}
      {(alwaysPill || !active) && pill}
    </button>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-3 pt-3">
      <div className="h-36 animate-pulse rounded-3xl bg-espresso-900" />
      <div className="h-12 animate-pulse rounded-2xl bg-espresso-900" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-espresso-900" />
      ))}
    </div>
  );
}
