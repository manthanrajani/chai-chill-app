/**
 * Timezone helpers without extra dependencies.
 * "Local" values are naive wall-clock times in the cafe timezone (e.g. Asia/Kolkata),
 * represented as JS Dates whose UTC fields hold the wall-clock values.
 */

function partsInTz(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Wall-clock time in `tz` for a real instant. */
export function toLocal(date: Date, tz: string): Date {
  const p = partsInTz(date, tz);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

/** Real instant for a wall-clock time in `tz`. */
export function fromLocal(local: Date, tz: string): Date {
  let guess = local.getTime();
  for (let i = 0; i < 2; i++) {
    const offset = toLocal(new Date(guess), tz).getTime() - new Date(guess).getTime();
    guess = local.getTime() - offset;
  }
  return new Date(guess);
}

export function startOfLocalDay(l: Date) {
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()));
}
export function startOfLocalMonth(l: Date) {
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1));
}
export function startOfLocalYear(l: Date) {
  return new Date(Date.UTC(l.getUTCFullYear(), 0, 1));
}
export function addDays(l: Date, n: number) {
  return new Date(l.getTime() + n * 86400000);
}
export function addMonths(l: Date, n: number) {
  const d = new Date(l);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
export function addYears(l: Date, n: number) {
  return addMonths(l, n * 12);
}

/** YYYY-MM-DD of a local date */
export function ymd(l: Date) {
  return l.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD into a local date (midnight). */
export function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return isNaN(d.getTime()) ? null : d;
}
