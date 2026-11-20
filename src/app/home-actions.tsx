"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Gamepad2, QrCode, ReceiptText } from "lucide-react";
import { usePersistentState } from "@/lib/use-persistent";
import { cn } from "@/lib/client";

export type LastTable = { code: string; number: number; at: number } | null;
const REMEMBER_MS = 12 * 60 * 60 * 1000; // a table visit is remembered for 12 hours

/** The three home tiles. They open the table this phone last scanned; otherwise they ask the guest to scan. */
export function HomeActions() {
  const router = useRouter();
  const [last] = usePersistentState<LastTable>("cc:last-table", null);
  const [hint, setHint] = useState(false);
  const table = last;

  function go(target: "menu" | "waiter" | "games") {
    // an old visit (e.g. yesterday) must not send the order to a stranger's table — ask to scan again
    if (!table || Date.now() - table.at > REMEMBER_MS) {
      setHint(true);
      return;
    }
    const q = target === "waiter" ? "?open=waiter" : target === "games" ? "?tab=games" : "";
    router.push(`/t/${table.code}${q}`);
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-stone-300">
        <Tile onClick={() => go("menu")} icon={<ReceiptText className="size-5" />} label="Order & pay" />
        <Tile onClick={() => go("waiter")} icon={<BellRing className="size-5" />} label="Call waiter" />
        <Tile onClick={() => go("games")} icon={<Gamepad2 className="size-5" />} label="Play games" />
      </div>

      {table ? (
        <button
          onClick={() => go("menu")}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-extrabold text-espresso-950 shadow-lg active:scale-[0.98]"
        >
          Continue at Table {String(table.number).padStart(2, "0")} →
        </button>
      ) : (
        hint && (
          <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-left animate-pop">
            <QrCode className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div className="text-sm">
              <div className="font-bold text-amber-200">First, scan the QR code on your table</div>
              <div className="mt-0.5 text-xs text-stone-300">
                Open your phone&apos;s camera and point it at the QR stand on your table. That tells us your table number, so your order and waiter call reach the right table.
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
}

function Tile({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border border-transparent bg-espresso-950 p-3 transition",
        "hover:border-amber-500/40 hover:bg-espresso-800 active:scale-95",
      )}
    >
      <span className="text-amber-400">{icon}</span>
      {label}
    </button>
  );
}
