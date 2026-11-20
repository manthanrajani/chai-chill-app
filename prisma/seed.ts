/**
 * Seed the database.
 *   npm run db:seed          → settings, admin + staff logins, menu, 8 tables (safe to run again)
 *   npm run db:seed -- --demo → ALSO adds ~2 years of realistic demo sales (only if there are no orders yet)
 *   npm run db:seed -- --demo --force → wipe ALL orders/bills/requests and regenerate demo sales
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, fromLocal, startOfLocalDay, toLocal } from "../src/lib/time";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c timezone=UTC" }) });
const args = new Set(process.argv.slice(2));

const MENU: { category: string; emoji: string; items: [string, number, string, string, string[]?][] }[] = [
  {
    category: "Chai & Coffee",
    emoji: "☕",
    items: [
      ["Adrak Elaichi Kulhad Chai", 60, "☕", "Freshly brewed Assam tea with crushed ginger & green cardamom, served in an earthen kulhad.", ["Bestseller"]],
      ["Masala Chai", 40, "🫖", "Classic street-style chai with our house masala blend."],
      ["Bun Maska & Irani Chai Combo", 110, "🥐", "Soft toasted bun loaded with white butter, served with classic Irani chai.", ["Bestseller"]],
      ["South Indian Filter Coffee", 70, "☕", "Strong decoction coffee with frothy hot milk, served in a davara-tumbler."],
      ["Hazelnut Cold Coffee", 145, "🧋", "Creamy blended espresso with roasted hazelnut syrup and vanilla ice cream.", ["Must try"]],
      ["Lemon Mint Iced Tea", 99, "🍹", "Chilled black tea shaken with fresh lemon, mint and a hint of honey."],
    ],
  },
  {
    category: "Snacks & Bites",
    emoji: "🍟",
    items: [
      ["Double Masala Cheese Maggi", 95, "🍜", "Street-style soupy masala Maggi topped with grated mozzarella and sweet corn.", ["Bestseller"]],
      ["Peri-Peri Loaded Fries", 130, "🍟", "Crispy fries tossed in spicy peri-peri dust with liquid cheddar & jalapeños.", ["Spicy"]],
      ["Crispy Cheese Corn Nuggets", 155, "🧀", "Golden bites stuffed with melted mozzarella & sweet corn, with chipotle dip."],
      ["Mumbai Vada Pav (2 pcs)", 70, "🍔", "Spicy batata vada in a soft pav with dry garlic chutney and fried chilli.", ["Spicy"]],
      ["Paneer Kathi Roll", 140, "🌯", "Tandoori paneer, onions & mint mayo wrapped in a flaky paratha."],
    ],
  },
  {
    category: "Burgers & Pizza",
    emoji: "🍕",
    items: [
      ['Paneer Tikka Makhani Pizza (8")', 249, "🍕", "Chargrilled tandoori paneer, onion, capsicum & makhani gravy on thin crust.", ["Chef's special"]],
      ["Smash Crispy Aloo Tikki Burger", 129, "🍔", "Spiced potato-pea patty, mint mayo, lettuce & cheese slice in a brioche bun."],
      ['Classic Margherita Pizza (8")', 199, "🍕", "San Marzano-style tomato sauce, mozzarella and fresh basil."],
      ["Veg Club Sandwich", 149, "🥪", "Triple-decker with veggies, cheese, coleslaw & fries on the side."],
    ],
  },
  {
    category: "Shakes & Desserts",
    emoji: "🍨",
    items: [
      ["Hot Sizzling Brownie Sundae", 185, "🍨", "Warm walnut brownie with vanilla scoop and hot chocolate fudge on a sizzler.", ["Bestseller"]],
      ["KitKat Oreo Thick Shake", 165, "🥤", "Rich chocolate shake blended with crushed KitKat and Oreo."],
      ["Mango Lassi", 110, "🥭", "Thick Punjabi lassi with Alphonso mango pulp."],
      ["Gulab Jamun with Rabdi", 120, "🍮", "Two warm gulab jamuns over chilled saffron rabdi."],
    ],
  },
];

function tableCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

async function seedBase() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      cafeName: "Chai & Chill Cafe",
      tagline: "100% Pure Veg • Scan, Order & Play",
      address: "Shop 4, Main Market Road",
      phone: "",
      wifiSsid: "ChaiAndChill_Free5G",
      wifiPassword: "chill2026",
      gstRateBp: 500,
      timezone: "Asia/Kolkata",
    },
  });

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "owner@chaichill.cafe").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe@123";
  if (!(await db.user.findUnique({ where: { email: adminEmail } }))) {
    await db.user.create({
      data: { name: "Cafe Owner", email: adminEmail, role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
    });
    console.log(`✔ Admin login: ${adminEmail} / ${adminPassword}`);
  }
  if (!(await db.user.findUnique({ where: { email: "kitchen@chaichill.cafe" } }))) {
    await db.user.create({
      data: { name: "Kitchen Staff", email: "kitchen@chaichill.cafe", role: "STAFF", passwordHash: await bcrypt.hash("Kitchen@123", 10) },
    });
    console.log("✔ Staff login: kitchen@chaichill.cafe / Kitchen@123");
  }

  if ((await db.category.count()) === 0) {
    for (const [ci, cat] of MENU.entries()) {
      await db.category.create({
        data: {
          name: cat.category,
          emoji: cat.emoji,
          sortOrder: ci,
          items: {
            create: cat.items.map(([name, price, emoji, description, tags], i) => ({
              name, pricePaise: price * 100, emoji, description, tags: tags ?? [], sortOrder: i,
            })),
          },
        },
      });
    }
    console.log(`✔ Menu: ${MENU.reduce((n, c) => n + c.items.length, 0)} dishes in ${MENU.length} categories`);
  }

  if ((await db.cafeTable.count()) === 0) {
    for (let n = 1; n <= 8; n++) {
      await db.cafeTable.create({ data: { number: n, seats: n % 3 === 0 ? 6 : n % 2 === 0 ? 4 : 2, code: tableCode() } });
    }
    console.log("✔ Tables 1–8 created");
  }
}

// ---------------------------------------------------------------------------
// Demo history
// ---------------------------------------------------------------------------
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function pickWeighted<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = Math.random() * total;
  for (const t of items) if ((r -= weight(t)) <= 0) return t;
  return items[items.length - 1];
}
const DEMO_DAYS = 730; // two years, so "this year vs last year" has something to compare
const HOUR_WEIGHTS: Record<number, number> = {
  9: 2, 10: 3, 11: 4, 12: 6, 13: 8, 14: 6, 15: 5, 16: 7, 17: 10, 18: 12, 19: 13, 20: 12, 21: 9, 22: 5,
};

async function seedDemo() {
  const existing = await db.order.count();
  if (existing > 0 && !args.has("--force")) {
    console.log(`ℹ ${existing} orders already exist — skipping demo data (use --demo --force to wipe & regenerate).`);
    return;
  }
  if (args.has("--force")) {
    await db.$transaction([
      db.orderItem.deleteMany(), db.order.deleteMany(), db.bill.deleteMany(),
      db.serviceRequest.deleteMany(), db.gameMatch.deleteMany(),
    ]);
  }

  const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  const tz = settings.timezone;
  const tables = await db.cafeTable.findMany({ orderBy: { number: "asc" } });
  const items = await db.menuItem.findMany({ where: { archived: false } });
  const popularity = new Map(items.map((m) => [m.id, (m.tags.includes("Bestseller") ? 3 : 1) * rand(0.6, 1.4)]));
  const now = new Date();
  const todayLocal = startOfLocalDay(toLocal(now, tz));

  const bills: object[] = [];
  const orders: object[] = [];
  const orderItems: object[] = [];

  for (let d = DEMO_DAYS; d >= 0; d--) {
    const day = addDays(todayLocal, -d);
    const dow = day.getUTCDay();
    const growth = 0.55 + 0.65 * ((DEMO_DAYS - d) / DEMO_DAYS); // the cafe grew over time
    const weekend = dow === 0 || dow === 6 ? 1.5 : dow === 5 ? 1.2 : 1;
    const nBills = Math.round(rand(14, 22) * growth * weekend);

    for (let b = 0; b < nBills; b++) {
      const hour = Number(pickWeighted(Object.keys(HOUR_WEIGHTS), (h) => HOUR_WEIGHTS[Number(h)]));
      const openLocal = new Date(day.getTime() + hour * 3600_000 + Math.floor(rand(0, 59)) * 60_000);
      const openedAt = fromLocal(openLocal, tz);
      const closedAt = new Date(openedAt.getTime() + rand(35, 80) * 60_000);
      if (closedAt > now) continue; // only finished bills in history

      const billId = randomUUID();
      const table = tables[Math.floor(Math.random() * tables.length)];
      const nOrders = Math.random() < 0.25 ? 2 : 1;
      let bSub = 0, bTax = 0;
      for (let o = 0; o < nOrders; o++) {
        const createdAt = new Date(openedAt.getTime() + o * rand(15, 25) * 60_000);
        const cancelled = Math.random() < 0.03;
        const nLines = Math.ceil(rand(0.01, 4));
        const chosen = new Set<string>();
        for (let i = 0; i < nLines; i++) chosen.add(pickWeighted(items, (m) => popularity.get(m.id)!).id);
        const orderId = randomUUID();
        let sub = 0;
        for (const id of chosen) {
          const m = items.find((x) => x.id === id)!;
          const qty = Math.random() < 0.7 ? 1 : 2;
          sub += m.pricePaise * qty;
          orderItems.push({ id: randomUUID(), orderId, menuItemId: id, name: m.name, unitPricePaise: m.pricePaise, qty, lineTotalPaise: m.pricePaise * qty });
        }
        const tax = Math.round((sub * settings.gstRateBp) / 10000);
        const prep = rand(6, 22) * 60_000;
        orders.push({
          id: orderId, tableId: table.id, billId, createdAt, updatedAt: createdAt,
          status: cancelled ? "CANCELLED" : "SERVED",
          subtotalPaise: sub, taxPaise: tax, totalPaise: sub + tax,
          preparingAt: cancelled ? null : new Date(createdAt.getTime() + 60_000),
          readyAt: cancelled ? null : new Date(createdAt.getTime() + prep),
          servedAt: cancelled ? null : new Date(createdAt.getTime() + prep + 120_000),
          cancelledAt: cancelled ? new Date(createdAt.getTime() + 60_000) : null,
          cancelReason: cancelled ? "Customer changed mind" : null,
        });
        if (!cancelled) { bSub += sub; bTax += tax; }
      }
      const method = pickWeighted(["UPI", "CASH", "CARD"] as const, (m) => ({ UPI: 6, CASH: 2.5, CARD: 1.5 })[m]);
      bills.push({
        id: billId, tableId: table.id, openedAt, closedAt,
        status: bSub > 0 ? "PAID" : "VOID",
        paymentMethod: bSub > 0 ? method : null,
        subtotalPaise: bSub, taxPaise: bTax, totalPaise: bSub + bTax,
      });
    }
  }

  // insert in chronological order so bill/order numbers increase with time
  bills.sort((a, b) => +(a as { openedAt: Date }).openedAt - +(b as { openedAt: Date }).openedAt);
  orders.sort((a, b) => +(a as { createdAt: Date }).createdAt - +(b as { createdAt: Date }).createdAt);
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  for (const c of chunk(bills, 2000)) await db.bill.createMany({ data: c as never });
  for (const c of chunk(orders, 2000)) await db.order.createMany({ data: c as never });
  for (const c of chunk(orderItems, 4000)) await db.orderItem.createMany({ data: c as never });
  console.log(`✔ Demo history: ${bills.length} bills, ${orders.length} orders, ${orderItems.length} order lines`);

  // a little live activity so the kitchen screen isn't empty
  const byName = (n: string) => items.find((m) => m.name.startsWith(n))!;
  const live = [
    { table: 2, status: "PREPARING" as const, lines: [["Hazelnut Cold Coffee", 2], ["Peri-Peri Loaded Fries", 1]] as const, notes: "Extra peri-peri seasoning", ago: 6 },
    { table: 6, status: "PLACED" as const, lines: [["Paneer Tikka Makhani", 1], ["Adrak Elaichi", 2]] as const, notes: "Cut into 6 slices", ago: 1 },
  ];
  for (const l of live) {
    const table = tables.find((t) => t.number === l.table)!;
    const lines = l.lines.map(([n, qty]) => { const m = byName(n); return { menuItemId: m.id, name: m.name, unitPricePaise: m.pricePaise, qty, lineTotalPaise: m.pricePaise * qty }; });
    const sub = lines.reduce((s, x) => s + x.lineTotalPaise, 0);
    const tax = Math.round((sub * settings.gstRateBp) / 10000);
    const createdAt = new Date(now.getTime() - l.ago * 60_000);
    const bill = await db.bill.create({ data: { tableId: table.id, openedAt: createdAt, subtotalPaise: sub, taxPaise: tax, totalPaise: sub + tax } });
    await db.order.create({
      data: {
        tableId: table.id, billId: bill.id, status: l.status, notes: l.notes, createdAt,
        subtotalPaise: sub, taxPaise: tax, totalPaise: sub + tax,
        preparingAt: l.status === "PREPARING" ? new Date(createdAt.getTime() + 60_000) : null,
        items: { create: lines },
      },
    });
  }
  const t6 = tables.find((t) => t.number === 6)!;
  await db.serviceRequest.create({ data: { tableId: t6.id, type: "WATER", message: "Need drinking water (2 glasses)" } });
  console.log("✔ Live demo: 2 kitchen orders + 1 water request");
}

async function main() {
  await seedBase();
  if (args.has("--demo")) await seedDemo();
  const tables = await db.cafeTable.findMany({ orderBy: { number: "asc" }, select: { number: true, code: true } });
  console.log("\nTable QR links (open on a phone, or print from Admin → Tables):");
  for (const t of tables) console.log(`  Table ${String(t.number).padStart(2, "0")}: /t/${t.code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
