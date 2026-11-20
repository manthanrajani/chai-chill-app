"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, BellRing, ChefHat, Download, Minus, ReceiptText, Table2, Timer } from "lucide-react";
import { cn, fetcher } from "@/lib/client";
import { formatINR, formatINRCompact, plural } from "@/lib/money";
import { Card, PageHeader, RangePicker, type RangeKey, Empty } from "@/components/admin-ui";

type Summary = { revenuePaise: number; netPaise: number; taxPaise: number; orders: number; itemsSold: number; avgOrderPaise: number; cancelled: number };
type Overview = {
  generatedAt: string;
  periods: { key: string; label: string; compareLabel: string; current: Summary; previous: Summary }[];
  allTime: Summary;
  live: { activeOrders: number; openBills: number; openBillsPaise: number; openRequests: number; tables: number };
};
type Report = {
  range: { key: string; from: string; to: string; bucket: "hour" | "day" | "month" };
  summary: Summary;
  series: { bucket: string; revenuePaise: number; orders: number }[];
  topItems: { name: string; qty: number; revenuePaise: number }[];
  categories: { name: string; emoji: string; qty: number; revenuePaise: number }[];
  payments: { method: string; bills: number; amountPaise: number }[];
  hours: { hour: number; orders: number; revenuePaise: number }[];
  tables: { number: number; orders: number; revenuePaise: number }[];
  avgPrepMinutes: number | null;
};

const CHART = "#c44f1c"; // validated single-series brand hue (≥3:1 on white)
const num = new Intl.NumberFormat("en-IN");

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Dashboard() {
  const overview = useSWR<Overview>("/api/admin/overview", fetcher, { refreshInterval: 30_000 });
  const me = useSWR<{ user: { name: string } | null }>("/api/auth/me", fetcher);
  const [r, setR] = useState<{ range: RangeKey; from: string; to: string }>({ range: "today", from: "", to: "" });
  const qs = new URLSearchParams({ range: r.range, ...(r.range === "custom" && { from: r.from, to: r.to }) }).toString();
  const customIncomplete = r.range === "custom" && (!r.from || !r.to);
  const report = useSWR<Report>(customIncomplete ? null : `/api/admin/report?${qs}`, fetcher, { refreshInterval: 60_000, keepPreviousData: true });

  const o = overview.data;
  return (
    <div>
      <PageHeader
        title={`${greeting()}${me.data?.user ? `, ${me.data.user.name}` : ""} 👋`}
        subtitle="Here's how your cafe is doing. Numbers include GST and exclude cancelled orders."
      />

      {/* live strip */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <LiveChip icon={<ChefHat className="size-4" />} label="Orders in kitchen" value={o ? num.format(o.live.activeOrders) : "–"} />
        <LiveChip icon={<ReceiptText className="size-4" />} label="Open bills to collect" value={o ? formatINR(o.live.openBillsPaise) : "–"} sub={o ? plural(o.live.openBills, "table") : undefined} />
        <LiveChip icon={<BellRing className="size-4" />} label="Waiting table requests" value={o ? num.format(o.live.openRequests) : "–"} alert={!!o?.live.openRequests} />
        <Link href="/kitchen" className="flex items-center justify-center gap-2 rounded-2xl bg-espresso-900 p-3 text-sm font-bold text-brand-300 hover:bg-espresso-800">
          <ChefHat className="size-4" /> Open live kitchen screen
        </Link>
      </div>

      {/* Today / Month / Year */}
      <div className="grid gap-4 lg:grid-cols-3">
        {o
          ? o.periods.map((p) => <PeriodCard {...p} key={p.key} />)
          : [0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-white" />)}
      </div>
      {o && (
        <p className="mt-2 text-right text-xs text-stone-500">
          All-time: <b className="text-stone-700">{formatINR(o.allTime.revenuePaise)}</b> from {num.format(o.allTime.orders)} orders
        </p>
      )}

      {/* Detailed report */}
      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">Sales report</h2>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <RangePicker {...r} onChange={setR} />
          <a
            href={customIncomplete ? undefined : `/api/admin/orders/export?${qs}`}
            className={cn("inline-flex items-center gap-1.5 rounded-xl border border-cream-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:border-brand-500", customIncomplete && "pointer-events-none opacity-50")}
          >
            <Download className="size-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {customIncomplete ? (
        <Empty>Pick a from and to date to see the report.</Empty>
      ) : report.error ? (
        <Empty>{(report.error as Error).message}</Empty>
      ) : !report.data ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
      ) : (
        <ReportView data={report.data} />
      )}
    </div>
  );
}

function LiveChip({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-white p-3", alert ? "border-rose-300" : "border-cream-300")}>
      <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold", alert ? "text-rose-600" : "text-stone-500")}>{icon} {label}</div>
      <div className="mt-1 font-display text-xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-stone-500">{sub}</div>}
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="inline-flex items-center gap-0.5 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">{current > 0 ? "New" : "—"}</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold", flat ? "bg-stone-100 text-stone-600" : up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
      <Icon className="size-3.5" aria-hidden />
      {flat ? "Same" : `${up ? "+" : ""}${pct.toFixed(pct > -10 && pct < 10 ? 1 : 0)}%`}
    </span>
  );
}

function PeriodCard({ label, compareLabel, current, previous }: Overview["periods"][number]) {
  return (
    <div className="rounded-2xl border border-cream-300 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">{label}</h3>
        <Delta current={current.revenuePaise} previous={previous.revenuePaise} />
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-stone-900 sm:text-4xl">{formatINR(current.revenuePaise)}</div>
      <div className="text-xs text-stone-500">
        {compareLabel}: {formatINR(previous.revenuePaise)}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-cream-200 pt-4 text-center">
        <Mini label="Orders" value={num.format(current.orders)} delta={<Delta current={current.orders} previous={previous.orders} />} />
        <Mini label="Avg. order" value={formatINR(current.avgOrderPaise)} />
        <Mini label="Items sold" value={num.format(current.itemsSold)} />
      </dl>
    </div>
  );
}

function Mini({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-stone-500">{label}</dt>
      <dd className="font-display text-base font-bold tabular-nums">{value}</dd>
      {delta && <dd className="mt-0.5 scale-90">{delta}</dd>}
    </div>
  );
}

function bucketLabel(b: string, kind: Report["range"]["bucket"], long = false) {
  if (kind === "hour") {
    const h = Number(b.slice(11, 13));
    const s = `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
    return long ? `${s} – ${(h + 1) % 12 || 12}${h + 1 < 12 || h + 1 === 24 ? "am" : "pm"}` : s;
  }
  const d = new Date(kind === "month" ? `${b}-01T00:00:00Z` : `${b}T00:00:00Z`);
  return kind === "month"
    ? d.toLocaleDateString("en-IN", { month: long ? "long" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: long ? "short" : undefined, timeZone: "UTC" });
}

function ChartTip({ active, payload, kind }: { active?: boolean; payload?: { payload: { bucket: string; revenuePaise: number; orders: number } }[]; kind: Report["range"]["bucket"] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-bold text-stone-900">{bucketLabel(p.bucket, kind, true)}</div>
      <div className="mt-0.5 text-stone-700">{formatINR(p.revenuePaise)}</div>
      <div className="text-stone-500">{p.orders} order{p.orders === 1 ? "" : "s"}</div>
    </div>
  );
}

function ReportView({ data }: { data: Report }) {
  const [asTable, setAsTable] = useState(false);
  const s = data.summary;
  const kind = data.range.bucket;
  const activeHours = data.hours.filter((h) => h.orders > 0).map((h) => h.hour);
  const lo = activeHours.length ? Math.min(...activeHours) : 8;
  const hi = activeHours.length ? Math.max(...activeHours) : 23;
  const hours = data.hours.filter((h) => h.hour >= lo && h.hour <= hi);
  const peak = data.hours.reduce((a, b) => (b.orders > a.orders ? b : a), data.hours[0]);
  const periodText = data.range.from === data.range.to ? fmtDay(data.range.from) : `${fmtDay(data.range.from)} – ${fmtDay(data.range.to)}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">{periodText}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total sales (incl. GST)" value={formatINR(s.revenuePaise)} strong />
        <Kpi label="Net sales (excl. GST)" value={formatINR(s.netPaise)} sub={`GST collected ${formatINR(s.taxPaise)}`} />
        <Kpi label="Orders" value={num.format(s.orders)} sub={s.cancelled ? `${s.cancelled} cancelled` : "0 cancelled"} />
        <Kpi label="Average order" value={formatINR(s.avgOrderPaise)} sub={`${num.format(s.itemsSold)} items sold`} />
      </div>

      <Card
        title="Sales trend"
        subtitle={kind === "hour" ? "Sales per hour" : kind === "day" ? "Sales per day" : "Sales per month"}
        actions={
          <button onClick={() => setAsTable((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:border-brand-500">
            <Table2 className="size-3.5" /> {asTable ? "Show chart" : "Show table"}
          </button>
        }
      >
        {s.orders === 0 ? (
          <Empty>No sales in this period yet.</Empty>
        ) : asTable ? (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-stone-500"><tr><th className="py-1.5">Period</th><th className="text-right">Orders</th><th className="text-right">Sales</th></tr></thead>
              <tbody>
                {data.series.filter((x) => x.orders > 0).map((x) => (
                  <tr key={x.bucket} className="border-t border-cream-200"><td className="py-1.5">{bucketLabel(x.bucket, kind, true)}</td><td className="text-right tabular-nums">{x.orders}</td><td className="text-right tabular-nums">{formatINR(x.revenuePaise)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke="#ece3d6" />
                <XAxis dataKey="bucket" tickFormatter={(b) => bucketLabel(b, kind)} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#ddd0bd" }} minTickGap={12} />
                <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} width={56} />
                <Tooltip content={<ChartTip kind={kind} />} cursor={{ fill: "#f6f1ea" }} />
                <Bar dataKey="revenuePaise" fill={CHART} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Best-selling dishes" subtitle="Top 10 by sales">
          <RankList rows={data.topItems.map((t) => ({ label: t.name, value: t.revenuePaise, sub: `${num.format(t.qty)} sold` }))} />
        </Card>
        <Card title="Busiest hours" subtitle={peak && peak.orders ? `Peak: ${bucketLabel(`2000-01-01T${String(peak.hour).padStart(2, "0")}`, "hour", true)} (${peak.orders} orders)` : "Orders by hour of day"}>
          {s.orders === 0 ? (
            <Empty>No orders yet.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours.map((h) => ({ ...h, bucket: `2000-01-01T${String(h.hour).padStart(2, "0")}` }))} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ece3d6" />
                  <XAxis dataKey="bucket" tickFormatter={(b) => bucketLabel(b, "hour")} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#ddd0bd" }} interval="preserveStartEnd" />
                  <YAxis dataKey="orders" allowDecimals={false} tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip kind="hour" />} cursor={{ fill: "#f6f1ea" }} />
                  <Bar dataKey="orders" fill={CHART} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Sales by category">
          <RankList rows={data.categories.map((c) => ({ label: `${c.emoji} ${c.name}`, value: c.revenuePaise, sub: plural(c.qty, "item") }))} showShare />
        </Card>
        <Card title="Payments collected" subtitle="Bills closed in this period">
          <RankList rows={data.payments.map((p) => ({ label: p.method === "UPI" ? "📱 UPI" : p.method === "CASH" ? "💵 Cash" : "💳 Card", value: p.amountPaise, sub: plural(p.bills, "bill") }))} showShare />
        </Card>
        <Card title="Table performance">
          <RankList rows={data.tables.map((t) => ({ label: `Table ${String(t.number).padStart(2, "0")}`, value: t.revenuePaise, sub: plural(t.orders, "order") }))} />
        </Card>
        <Card title="Kitchen speed">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Timer className="size-7" /></div>
            <div>
              <div className="font-display text-3xl font-extrabold tabular-nums">{data.avgPrepMinutes == null ? "—" : `${data.avgPrepMinutes.toFixed(1)} min`}</div>
              <div className="text-sm text-stone-500">Average time from order to “ready”</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function fmtDay(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Kpi({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", strong ? "border-espresso-900 bg-espresso-900 text-white" : "border-cream-300 bg-white")}>
      <div className={cn("text-xs font-semibold", strong ? "text-brand-300" : "text-stone-500")}>{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className={cn("text-xs", strong ? "text-stone-300" : "text-stone-500")}>{sub}</div>}
    </div>
  );
}

/** Ranked list with an inline bar — every row is labelled, so it reads without colour. */
function RankList({ rows, showShare }: { rows: { label: string; value: number; sub?: string }[]; showShare?: boolean }) {
  if (!rows.length) return <Empty>No data for this period.</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-semibold text-stone-800"><span className="mr-1.5 text-xs text-stone-400">{i + 1}.</span>{r.label}</span>
            <span className="shrink-0 tabular-nums font-bold">{formatINR(r.value)}{showShare && <span className="ml-1.5 text-xs font-semibold text-stone-500">{Math.round((r.value / total) * 100)}%</span>}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-cream-100">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: CHART }} />
            </div>
            {r.sub && <span className="w-20 shrink-0 text-right text-[11px] text-stone-500">{r.sub}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
