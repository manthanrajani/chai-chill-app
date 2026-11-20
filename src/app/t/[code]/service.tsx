"use client";

import { useState } from "react";
import { BellRing, Check, Copy, GlassWater, Loader2, ReceiptText, Sparkles, UserRound, Wifi } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { api, cn, timeAgo } from "@/lib/client";
import { chime } from "@/lib/sound";
import type { RequestType, TableResponse } from "./types";

const QUICK: { type: RequestType; label: string; hint: string; icon: typeof BellRing; tone: string }[] = [
  { type: "WAITER", label: "Call waiter", hint: "Personal help", icon: UserRound, tone: "text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10" },
  { type: "WATER", label: "Need water", hint: "Glasses / bottle", icon: GlassWater, tone: "text-sky-400 hover:border-sky-500/50 hover:bg-sky-500/10" },
  { type: "CLEAN", label: "Clean table", hint: "Tissues / wipe", icon: Sparkles, tone: "text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10" },
  { type: "BILL", label: "Ask for bill", hint: "UPI / card / cash", icon: ReceiptText, tone: "text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10" },
];

export function WaiterSheet({ open, onClose, code, tableNo, requests, onSent }: { open: boolean; onClose: () => void; code: string; tableNo: string; requests: TableResponse["requests"]; onSent: () => void }) {
  const toast = useToast();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<RequestType | null>(null);

  async function send(type: RequestType, message?: string) {
    setBusy(type);
    try {
      const res = await api<{ duplicate: boolean }>(`/api/t/${code}/requests`, "POST", { type, message });
      chime("alert");
      toast(res.duplicate ? "Already on it!" : "Staff notified", { body: res.duplicate ? "Your request is already on the staff screen." : "Someone will come to your table shortly." });
      if (type === "CUSTOM") setCustom("");
      onSent();
      onClose();
    } catch (e) {
      toast("Couldn't send", { body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const pending = new Set(requests.map((r) => r.type));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Table ${tableNo} assistance`}
      subtitle="One tap — it shows up on the staff screen instantly"
      icon={<div className="grid size-10 place-items-center rounded-xl bg-rose-500/15 text-rose-400"><BellRing className="size-5" /></div>}
    >
      {requests.length > 0 && (
        <div className="mb-3 space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Staff has been notified</div>
          {requests.map((r) => (
            <div key={r.id} className="flex justify-between gap-2 text-xs text-stone-200">
              <span className="truncate">{r.message}</span>
              <span className="shrink-0 text-stone-400">{timeAgo(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.type}
              onClick={() => send(q.type)}
              disabled={!!busy}
              className={cn("relative rounded-2xl border border-stone-800 bg-espresso-950 p-3 text-left transition disabled:opacity-60", q.tone)}
            >
              {busy === q.type ? <Loader2 className="mb-1.5 size-5 animate-spin" /> : <Icon className="mb-1.5 size-5" />}
              <div className="text-sm font-bold text-white">{q.label}</div>
              <div className="text-[11px] text-stone-400">{pending.has(q.type) ? "✓ Requested" : q.hint}</div>
            </button>
          );
        })}
      </div>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) send("CUSTOM", custom.trim());
        }}
      >
        <label className="text-xs font-semibold text-stone-300" htmlFor="custom-req">Koi aur request?</label>
        <div className="mt-1 flex gap-2">
          <input
            id="custom-req"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={200}
            placeholder="Extra spoons, charging point…"
            className="min-w-0 flex-1 rounded-xl border border-stone-800 bg-espresso-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400"
          />
          <button disabled={!custom.trim() || !!busy} className="rounded-xl bg-rose-500 px-4 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-50">Send</button>
        </div>
      </form>
    </Sheet>
  );
}

export function WifiSheet({ open, onClose, ssid, password }: { open: boolean; onClose: () => void; ssid: string; password: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // older browsers / http — fallback
      const t = document.createElement("textarea");
      t.value = password;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    chime("success");
    toast("Password copied!", { body: "Open Wi-Fi settings, pick the network and paste.", tone: "info" });
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Free cafe Wi-Fi"
      subtitle="Complimentary for our guests"
      icon={<div className="grid size-10 place-items-center rounded-xl bg-sky-500/15 text-sky-400"><Wifi className="size-5" /></div>}
    >
      {!ssid ? (
        <p className="rounded-xl bg-espresso-950 p-4 text-sm text-stone-400">Wi-Fi details aren&apos;t set up yet — please ask the staff.</p>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-stone-800 bg-espresso-950 p-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Network name</div>
              <div className="mt-0.5 text-base font-extrabold text-white">{ssid}</div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-800 pt-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Password</div>
                <div className="truncate font-mono text-lg font-extrabold text-sky-400">{password || "— open network —"}</div>
              </div>
              {password && (
                <button onClick={copy} className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition", copied ? "bg-emerald-500 text-espresso-950" : "bg-sky-500 text-espresso-950 hover:bg-sky-400")}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
          <ol className="mt-4 space-y-1.5 text-xs text-stone-400">
            <li>1. Copy the password above.</li>
            <li>2. Open your phone&apos;s Wi-Fi settings and choose <b className="text-stone-200">{ssid}</b>.</li>
            <li>3. Paste the password and connect. Tip: the QR stand on your table also has a Wi-Fi QR you can scan with your camera.</li>
          </ol>
        </>
      )}
    </Sheet>
  );
}
