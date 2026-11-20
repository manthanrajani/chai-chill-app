# Chai & Chill Cafe — Smart Table App

Customers scan the QR code on their table to see the menu, order straight to the kitchen, call a waiter, get the Wi-Fi password, pay by UPI and play games while they wait. The kitchen gets a live order screen, and the owner gets a sales dashboard.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 7 · SWR · Recharts

---

## The four screens

| Who | URL | What they do |
|---|---|---|
| **Customer** (phone) | `/t/<table-code>` (opens straight from the table QR) | Three tabs: **Menu** (search, categories, cart, cooking notes) · **Orders** (waiting / cooking / ready / served counts, estimated ready time with countdown, orders ahead in the queue, a timeline with times for each step, how long each served order took) · **Play** (games). Also call waiter / water / clean / bill, Wi-Fi password, running bill with CGST/SGST and **Pay via UPI**. The phone vibrates and chimes when food is ready. |
| **Kitchen & floor staff** (tablet) | `/kitchen` | New → Preparing → Ready → Served board with timers, sound bell for new orders, table requests, floor map, **close bills (Cash / UPI / Card)**, print bill, mark dishes **sold out**, pause online ordering |
| **Staff entrance** | `/staff` | Private link for the team (bookmark it on the kitchen tablet and the owner's phone). Sends people to login, then to the kitchen screen or owner dashboard by role. Customers never see staff links. |
| **Owner** | `/admin` | **Table bell alerts on every admin page:** when a table taps Call waiter / Water / Clean / Bill, a ringing card shows *which table* and what they need, and keeps ringing every 20 s until someone taps **Done**. Also: new-order pop-ups, a flashing browser-tab title, and desktop notifications when the tab is in the background (tap "Turn on table bell" once per device). Sales for **today / this month / this year** compared with the same time in the previous period, plus a report for any date range: sales trend, best-sellers, busiest hours, categories, payment split, table performance, kitchen speed, **CSV export** |
| | `/admin/orders` | Searchable order and bill history |
| | `/admin/menu` | Add, edit and remove dishes and categories; prices, tags, photos, sold out |
| | `/admin/tables` | Add tables, **print QR table cards** (order QR + Wi-Fi QR), replace a leaked QR |
| | `/admin/staff` | Create kitchen and admin logins, reset passwords, disable people who have left |
| | `/admin/settings` | Cafe name, GST %, GSTIN, UPI ID, Wi-Fi, timezone |

### Games
- **Same table:** Tic-Tac-Toe (pass the phone), Desi Quiz (Team A vs Team B, 22 Bollywood / cricket / food questions), Stone-Paper-Scissors against a Cafe Bot.
- **Against another table (real multiplayer):** challenge any table that is online to Tic-Tac-Toe or Stone-Paper-Scissors (first to 3). Each side's pick stays hidden until both tables have chosen. Includes quick reactions and rematch. Abandoned games expire automatically.

---

## Run it locally

Requirements: Node 20.9+ and PostgreSQL 14+.

```bash
cp .env.example .env            # then edit DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate deploy       # create the tables
npm run db:seed                 # menu, 8 tables, logins
npm run db:demo                 # OPTIONAL: adds 2 years of fake sales so the dashboard has data
npm run dev                     # http://localhost:3000
```

The seed prints a QR link for every table. You can also open them from **Admin → Tables → Open as customer**.

**Default logins (change these right away in Admin → Staff logins):**

| Role | Email | Password |
|---|---|---|
| Owner (admin) | `owner@chaichill.cafe` | `ChangeMe@123` |
| Kitchen staff | `kitchen@chaichill.cafe` | `Kitchen@123` |

You can set the owner login before seeding with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`.

> ⚠️ **Before handing it to a real cafe:** don't run `db:demo` (or wipe it with a fresh database), change both passwords, and set the cafe's real UPI ID, GSTIN and Wi-Fi in Settings.

**Testing with real phones on the cafe Wi-Fi:** run `npm run build && npm start` on a computer connected to the cafe Wi-Fi. When you open the admin on that computer, **Admin → Tables** automatically puts this computer's Wi-Fi address (e.g. `http://192.168.1.5:3000`) into the QR codes, so scanning them with a phone on the same Wi-Fi opens the table's menu directly. (If macOS asks whether to allow incoming connections for "node", click Allow.) For a permanent setup, deploy online (below) and set your domain under Admin → Tables.

---

## Going live (recommended setup)

1. **Database:** create a free PostgreSQL database on [Neon](https://neon.tech) or [Supabase](https://supabase.com), and copy the connection string.
2. **Hosting:** push this folder to GitHub and import it on [Vercel](https://vercel.com). Add the environment variables `DATABASE_URL` and `AUTH_SECRET` (generate one with `openssl rand -base64 32`).
3. Run the migrations and seed once against the live database:
   `DATABASE_URL="..." npx prisma migrate deploy && DATABASE_URL="..." npm run db:seed`
4. Connect a domain such as `order.yourcafe.in`, set it under Admin → Tables, then print and laminate the QR cards.

A small VPS or Railway/Render works too: `npm run build && npm start`.

---

## How the business rules work

- **Bills:** a table's first order opens a bill, and later orders from any phone at that table are added to it. A database constraint guarantees only one open bill per table, even if two phones order at the same moment. Staff close the bill once payment is received, and the table becomes free.
- **Prices are calculated on the server** from the database, so a customer can't change a price from their browser. Each order stores a copy of the dish names and prices, so editing the menu later never changes old bills or reports.
- **Money** is stored as whole paise (integers), so no rounding errors. GST is shown as CGST + SGST.
- **Sales figures** count every order that wasn't cancelled, at the time it was placed, including GST (the net figure excluding GST is shown separately). Payment split counts bills that were closed in the period.
- **Timezone:** all "today / month / year" figures use the cafe's timezone (default Asia/Kolkata), whatever timezone the server runs in.
- **Order flow:** Placed → Preparing → Ready → Served (or Cancelled). Steps can't be skipped. A customer can only cancel before the kitchen accepts the order.
- **Removing a dish** hides it from the menu but keeps it in history and reports.
- **Security:** staff pages and APIs need a signed-in, active user, and owner-only pages need an Admin. Passwords are hashed with bcrypt, and repeated failed logins are slowed down. Table links use random, unguessable codes, and a leaked code can be replaced. Reactions between tables come from a fixed list, so strangers can't send free text to each other.

### Real-time
Screens refresh automatically: kitchen every 3 s, customer every 4 s, games every 1.5 s, dashboard every 30 s. This works on any host, including serverless platforms, and needs no extra services.

---

## Useful commands

| Command | |
|---|---|
| `npm run dev` | development server |
| `npm run build && npm start` | production |
| `npm run db:migrate` | apply migrations (production) |
| `npm run db:seed` | create the base data (safe to run again) |
| `npm run db:demo` | add demo sales history (skipped if orders already exist) |
| `npx tsx prisma/seed.ts --demo --force` | **wipe all orders and bills** and regenerate demo data |
| `npm run db:studio` | browse the database in a GUI |
| `npm run lint` / `npm run typecheck` | code checks |

## Project layout

```
prisma/schema.prisma        database tables
prisma/seed.ts              menu, tables, logins, demo data
src/proxy.ts                login protection for /kitchen and /admin
src/lib/orders.ts           ordering, bills, status changes, waiter requests
src/lib/analytics.ts        today / month / year and range reports
src/lib/games.ts            multiplayer games between tables
src/app/t/[code]/           customer app
src/app/kitchen/            kitchen & floor screen
src/app/admin/              owner dashboard & management
src/app/api/                JSON API (public /t/*, staff /staff/*, admin /admin/*)
```
