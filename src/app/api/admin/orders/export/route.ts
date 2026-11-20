import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toLocal } from "@/lib/time";
import { parseOrderQuery } from "../query";

function csvCell(v: unknown) {
  const s = String(v ?? "");
  // prevent spreadsheet formula injection & escape quotes
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Download orders as CSV (opens in Excel / Google Sheets). */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const s = await getSettings();
  const { where, range } = parseOrderQuery(new URL(req.url), s.timezone);
  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 50_000,
    include: {
      table: { select: { number: true } },
      items: { select: { name: true, qty: true } },
      bill: { select: { billNo: true, status: true, paymentMethod: true } },
    },
  });
  const header = ["Order No", "Date", "Time", "Table", "Customer", "Items", "Qty", "Subtotal (₹)", "GST (₹)", "Total (₹)", "Status", "Bill No", "Bill Status", "Payment", "Notes"];
  const rows = orders.map((o) => {
    const l = toLocal(o.createdAt, s.timezone).toISOString();
    return [
      o.orderNo, l.slice(0, 10), l.slice(11, 16), o.table.number, o.customerName ?? "",
      o.items.map((i) => `${i.qty}x ${i.name}`).join("; "),
      o.items.reduce((n, i) => n + i.qty, 0),
      (o.subtotalPaise / 100).toFixed(2), (o.taxPaise / 100).toFixed(2), (o.totalPaise / 100).toFixed(2),
      o.status, o.bill.billNo, o.bill.status, o.bill.paymentMethod ?? "", o.notes ?? "",
    ].map(csvCell).join(",");
  });
  const body = "﻿" + [header.join(","), ...rows].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders_${range.label.from}_to_${range.label.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
