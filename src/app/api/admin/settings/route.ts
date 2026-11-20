import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  cafeName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(100),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(30),
  gstin: z.string().trim().max(20),
  pureVeg: z.boolean(),
  gstRateBp: z.number().int().min(0).max(2800),
  wifiSsid: z.string().trim().max(60),
  wifiPassword: z.string().max(60),
  upiId: z.string().trim().max(60).regex(/^$|^[\w.\-]+@[\w.\-]+$/, "UPI ID looks wrong (example: cafe@okaxis)"),
  timezone: z.string().refine((tz) => {
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
  }, "Unknown timezone"),
  acceptingOrders: z.boolean(),
}).partial();

export const GET = handle(async () => {
  await requireAdmin();
  return json({ settings: await getSettings() });
});

export const PATCH = handle(async (req: Request) => {
  await requireAdmin();
  const data = schema.parse(await readJson(req));
  const settings = await db.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  return json({ settings });
});
