import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getOverview } from "@/lib/analytics";
import { getSettings } from "@/lib/settings";

export const GET = handle(async () => {
  await requireAdmin();
  const s = await getSettings();
  return json(await getOverview(s.timezone));
});
