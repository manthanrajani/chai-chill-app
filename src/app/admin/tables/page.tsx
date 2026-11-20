"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import QRCode from "qrcode";
import { ExternalLink, Plus, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import { api, cn, fetcher } from "@/lib/client";
import { isLocalUrl, useBaseUrl } from "@/lib/use-base-url";
import { Btn, Card, Field, PageHeader, Toggle, inputCls } from "@/components/admin-ui";
import { useToast } from "@/components/toast";

type Table = { id: number; number: number; label: string | null; seats: number; code: string; active: boolean; online: boolean };

function BaseUrlEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex flex-wrap gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} className={cn(inputCls, "min-w-64 flex-1")} placeholder="https://order.yourcafe.in" />
      <Btn variant="ghost" onClick={() => onSave(v)}>Save</Btn>
    </div>
  );
}

export default function TablesAdmin() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ tables: Table[] }>("/api/admin/tables", fetcher);
  const { url: base, saved, lanUrls, save: setBase } = useBaseUrl();
  const [newNo, setNewNo] = useState("");

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast(ok); mutate(); } catch (e) { toast((e as Error).message, { tone: "error" }); }
  }
  const nextNo = (data?.tables.reduce((m, t) => Math.max(m, t.number), 0) ?? 0) + 1;

  return (
    <div>
      <PageHeader
        title="Tables & QR codes"
        subtitle="Each table has its own secret QR link. Print them, laminate, and stick them on the tables."
        actions={<Link href="/admin/tables/print" target="_blank" className="inline-flex items-center gap-1.5 rounded-xl bg-espresso-900 px-3.5 py-2 text-sm font-bold text-amber-300"><Printer className="size-4" /> Print all QR cards</Link>}
      />

      <Card title="Website address in the QR codes" className="mb-4">
        <BaseUrlEditor key={base} initial={base} onSave={(v) => { setBase(v); toast("QR address saved"); }} />
        <p className="mt-2 text-xs text-stone-500">
          QR codes open: <a href={`${base}/t/…`} className="font-mono font-semibold text-stone-800">{base}/t/…</a>
          {!saved && " (set automatically)"}
        </p>
        {lanUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
            <span>This computer on Wi-Fi:</span>
            {lanUrls.map((u) => (
              <button key={u} onClick={() => { setBase(u); toast("QR address saved", { body: "Phones on the cafe Wi-Fi can open it" }); }} className={cn("rounded-lg border px-2 py-1 font-mono", u === base ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-cream-300 bg-white hover:border-amber-500")}>{u}</button>
            ))}
            {saved && <button onClick={() => { setBase(""); toast("Back to automatic address"); }} className="text-stone-500 underline">reset to automatic</button>}
          </div>
        )}
        {isLocalUrl(base) && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
            <TriangleAlert className="mt-px size-3.5 shrink-0" /> &quot;localhost&quot; only works on this computer — customers&apos; phones can&apos;t open it. Use your live website (e.g. https://order.yourcafe.in) or this computer&apos;s Wi-Fi address above before printing.
          </p>
        )}
      </Card>

      <Card title={`Tables (${data?.tables.length ?? 0})`} actions={
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(newNo || nextNo); run(() => api("/api/admin/tables", "POST", { number: n }), `Table ${n} added`); setNewNo(""); }}>
          <input type="number" min={1} value={newNo} onChange={(e) => setNewNo(e.target.value)} placeholder={`No. ${nextNo}`} className={cn(inputCls, "w-24 py-1.5")} aria-label="New table number" />
          <Btn type="submit"><Plus className="size-4" /> Add table</Btn>
        </form>
      }>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data?.tables.map((t) => <TableCard key={t.id} t={t} base={base} run={run} />)}
        </div>
      </Card>
    </div>
  );
}

function TableCard({ t, base, run }: { t: Table; base: string; run: (fn: () => Promise<unknown>, ok: string) => void }) {
  const url = `${base}/t/${t.code}`;
  const [qr, setQr] = useState("");
  const [label, setLabel] = useState(t.label ?? "");
  const [seats, setSeats] = useState(String(t.seats));
  useEffect(() => {
    if (base) QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#18110e" } }).then(setQr);
  }, [url, base]);
  const online = t.online;

  return (
    <div className={cn("rounded-2xl border p-4", t.active ? "border-cream-300 bg-cream-50" : "border-dashed border-stone-300 opacity-70")}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-xl font-extrabold">Table {String(t.number).padStart(2, "0")}</div>
          <div className="text-xs text-stone-500">{online ? "🟢 Someone is browsing now" : t.active ? "Active" : "Disabled"}</div>
        </div>
        <Toggle checked={t.active} label="Table active" onChange={(v) => run(() => api(`/api/admin/tables/${t.id}`, "PATCH", { active: v }), v ? "Table enabled" : "Table disabled")} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr && <img src={qr} alt={`QR code for table ${t.number}`} className="mx-auto my-3 size-36 rounded-lg bg-white p-1" />}
      <a href={`/t/${t.code}`} target="_blank" className="flex items-center justify-center gap-1 truncate text-xs font-semibold text-amber-700 hover:underline"><ExternalLink className="size-3" /> Open as customer</a>
      <div className="mt-3 grid grid-cols-[1fr_4.5rem] gap-2">
        <Field label="Label"><input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== (t.label ?? "") && run(() => api(`/api/admin/tables/${t.id}`, "PATCH", { label }), "Saved")} placeholder="e.g. Window" className={cn(inputCls, "py-1.5")} /></Field>
        <Field label="Seats"><input type="number" min={1} max={30} value={seats} onChange={(e) => setSeats(e.target.value)} onBlur={() => Number(seats) !== t.seats && run(() => api(`/api/admin/tables/${t.id}`, "PATCH", { seats: Number(seats) }), "Saved")} className={cn(inputCls, "py-1.5")} /></Field>
      </div>
      <button
        onClick={() => confirm(`Make a new QR for Table ${t.number}? The old printed QR will stop working.`) && run(() => api(`/api/admin/tables/${t.id}`, "PATCH", { regenerateCode: true }), "New QR code created — reprint this table's card")}
        className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-semibold text-stone-500 hover:text-rose-600"
      >
        <RefreshCw className="size-3" /> Replace QR code
      </button>
    </div>
  );
}
