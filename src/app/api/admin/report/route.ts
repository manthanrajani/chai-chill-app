import { z } from "zod";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getRangeReport } from "@/lib/analytics";
import { getSettings } from "@/lib/settings";

const rangeSchema = z.enum(["today", "yesterday", "7d", "30d", "month", "lastmonth", "year", "custom"]);

export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const range = rangeSchema.parse(url.searchParams.get("range") ?? "today");
  const s = await getSettings();
  return json(await getRangeReport(s.timezone, range, url.searchParams.get("from"), url.searchParams.get("to")));
});
