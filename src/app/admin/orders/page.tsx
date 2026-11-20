"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { cn, fetcher } from "@/lib/client";
import { formatINR } from "@/lib/money";
import { Card, Empty, PageHeader, RangePicker, inputCls, type RangeKey } from "@/components/admin-ui";

type Order = {
  id: string; orderNo: number; status: string; customerName: string | null; notes: string | null; totalPaise: number; createdAt: string; cancelReason: string | null;
  table: { number: number }; items: { name: string; qty: number; lineTotalPaise: number }[];
  bill: { billNo: number; status: string; paymentMethod: string | null };
};
type Bill = {
  id: string; billNo: number; status: string; paymentMethod: string | null; totalPaise: number; subtotalPaise: number; taxPaise: number; openedAt: string; closedAt: string | null;
  table: { number: number }; settledBy: { name: string } | null; orders: { orderNo: number; items: { name: string; qty: number }[] }[];
};

const STATUS_STYLE: Record<string, string> = {
  PLACED: "bg-brand-100 text-brand-800", PREPARING: "bg-sky-100 text-sky-800", READY: "bg-emerald-100 text-emerald-800",
  SERVED: "bg-stone-100 text-stone-700", CANCELLED: "bg-rose-100 text-rose-700",
  OPEN: "bg-brand-100 text-brand-800", PAID: "bg-emerald-100 text-emerald-800", VOID: "bg-stone-100 text-stone-500",
};

const dt = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function OrdersPage() {
  const [tab, setTab] = useState<"orders" | "bills">("orders");
  const [r, setR] = useState<{ range: RangeKey; from: string; to: string }>({ range: "today", from: "", to: "" });
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const incomplete = r.range === "custom" && (!r.from || !r.to);
  const base = { range: r.range, ...(r.range === "custom" && { from: r.from, to: r.to }) };
  const orderQs = new URLSearchParams({ ...base, status, q, page: String(page) }).toString();
  const orders = useSWR<{ orders: Order[]; total: number; page: number; pageSize: number; totalPaise: number }>(
    !incomplete && tab === "orders" ? `/api/admin/orders?${orderQs}` : null, fetcher, { keepPreviousData: true, refreshInterval: 15_000 });
  const bills = useSWR<{ bills: Bill[]; total: number; page: number; pageSize: number }>(
    !incomplete && tab === "bills" ? `/api/admin/bills?${new URLSearchParams({ ...base, page: String(page) })}` : null, fetcher, { keepPreviousData: true, refreshInterval: 15_000 });

  const reset = () => setPage(1);
  const exportQs = new URLSearchParams({ ...base, status, q }).toString();

  return (
    <div>
      <PageHeader
        title="Orders & bills"
        subtitle="Every order placed from the table QR codes, and every bill your staff closed."
        actions={<a href={incomplete ? undefined : `/api/admin/orders/export?${exportQs}`} className="inline-flex items-center gap-1.5 rounded-xl bg-espresso-900 px-3.5 py-2 text-sm font-bold text-brand-300"><Download className="size-4" /> Export CSV</a>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-cream-300 bg-white p-1">
          {(["orders", "bills"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); reset(); }} className={cn("rounded-lg px-4 py-1.5 text-sm font-bold capitalize", tab === t ? "bg-brand-600 text-white" : "text-stone-600")}>{t}</button>
          ))}
        </div>
        <RangePicker {...r} onChange={(v) => { setR(v); reset(); }} />
      </div>

      {tab === "orders" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search order no., customer or dish…" className={cn(inputCls, "pl-9")} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); reset(); }} className={cn(inputCls, "w-auto")}>
            {["ALL", "PLACED", "PREPARING", "READY", "SERVED", "CANCELLED"].map((s) => <option key={s} value={s}>{s === "ALL" ? "All statuses" : s.toLowerCase()}</option>)}
          </select>
        </div>
      )}

      {incomplete ? <Empty>Pick a from and to date.</Empty> : tab === "orders" ? (
        <Card title={orders.data ? `${orders.data.total} orders · ${formatINR(orders.data.totalPaise)} sales` : "Loading…"}>
          {orders.data?.orders.length === 0 ? <Empty>No orders match.</Empty> : (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-stone-500">
                  <tr className="border-b border-cream-200"><th className="px-4 py-2 sm:px-5">Order</th><th>Time</th><th>Table</th><th>Items</th><th>Status</th><th>Bill</th><th className="px-4 text-right sm:px-5">Total</th></tr>
                </thead>
                <tbody>
                  {orders.data?.orders.map((o) => (
                    <tr key={o.id} className="border-b border-cream-100 align-top hover:bg-cream-50">
                      <td className="px-4 py-2.5 font-bold sm:px-5">#{o.orderNo}{o.customerName && <div className="text-xs font-normal text-stone-500">{o.customerName}</div>}</td>
                      <td className="py-2.5 whitespace-nowrap text-stone-600">{dt(o.createdAt)}</td>
                      <td className="py-2.5">T{String(o.table.number).padStart(2, "0")}</td>
                      <td className="max-w-xs py-2.5 text-stone-700">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                        {o.notes && <div className="text-xs text-stone-500">Note: {o.notes}</div>}
                        {o.cancelReason && <div className="text-xs text-rose-600">Cancelled: {o.cancelReason}</div>}
                      </td>
                      <td className="py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_STYLE[o.status])}>{o.status.toLowerCase()}</span></td>
                      <td className="py-2.5 text-xs text-stone-600">#{o.bill.billNo}<div>{o.bill.status === "PAID" ? o.bill.paymentMethod : o.bill.status.toLowerCase()}</div></td>
                      <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums sm:px-5", o.status === "CANCELLED" && "text-stone-400 line-through")}>{formatINR(o.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {orders.data && <Pager page={page} total={orders.data.total} size={orders.data.pageSize} onPage={setPage} />}
        </Card>
      ) : (
        <Card title={bills.data ? `${bills.data.total} bills` : "Loading…"}>
          {bills.data?.bills.length === 0 ? <Empty>No bills in this period.</Empty> : (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-stone-500">
                  <tr className="border-b border-cream-200"><th className="px-4 py-2 sm:px-5">Bill</th><th>Table</th><th>Opened</th><th>Closed</th><th>Orders</th><th>Status</th><th>Closed by</th><th className="px-4 text-right sm:px-5">Total</th></tr>
                </thead>
                <tbody>
                  {bills.data?.bills.map((b) => (
                    <tr key={b.id} className="border-b border-cream-100 hover:bg-cream-50">
                      <td className="px-4 py-2.5 font-bold sm:px-5">#{b.billNo}</td>
                      <td>T{String(b.table.number).padStart(2, "0")}</td>
                      <td className="whitespace-nowrap text-stone-600">{dt(b.openedAt)}</td>
                      <td className="whitespace-nowrap text-stone-600">{b.closedAt ? dt(b.closedAt) : "—"}</td>
                      <td className="text-stone-600">{b.orders.map((o) => `#${o.orderNo}`).join(", ") || "—"}</td>
                      <td><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_STYLE[b.status])}>{b.status === "PAID" ? `paid · ${b.paymentMethod}` : b.status.toLowerCase()}</span></td>
                      <td className="text-stone-600">{b.settledBy?.name ?? "—"}</td>
                      <td className="px-4 text-right font-bold tabular-nums sm:px-5">{formatINR(b.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bills.data && <Pager page={page} total={bills.data.total} size={bills.data.pageSize} onPage={setPage} />}
        </Card>
      )}
    </div>
  );
}

function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-cream-300 p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
      <span className="text-stone-600">Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-cream-300 p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
    </div>
  );
}
