import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { getSettings } from "@/lib/settings";

/** Public menu for the customer app. */
export const GET = handle(async () => {
  const [settings, categories] = await Promise.all([
    getSettings(),
    db.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          where: { archived: false },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true, name: true, description: true, pricePaise: true, emoji: true,
            imageUrl: true, isVeg: true, tags: true, available: true,
          },
        },
      },
    }),
  ]);
  return json({
    cafe: {
      name: settings.cafeName,
      tagline: settings.tagline,
      pureVeg: settings.pureVeg,
      gstRateBp: settings.gstRateBp,
      acceptingOrders: settings.acceptingOrders,
    },
    categories: categories.filter((c) => c.items.length > 0),
  });
});
