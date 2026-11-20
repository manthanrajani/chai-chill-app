import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { getSettings } from "@/lib/settings";

/** Public: cafe name + the list of tables, for the "Which table are you at?" welcome screen. */
export const GET = handle(async () => {
  const [settings, tables] = await Promise.all([
    getSettings(),
    db.cafeTable.findMany({ where: { active: true }, orderBy: { number: "asc" }, select: { number: true, label: true, code: true } }),
  ]);
  return json({
    cafe: { name: settings.cafeName, tagline: settings.tagline, pureVeg: settings.pureVeg, acceptingOrders: settings.acceptingOrders },
    tables,
  });
});
