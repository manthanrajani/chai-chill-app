/** Money helpers. All amounts are integer paise (₹1 = 100 paise). */

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatINR(paise: number | null | undefined): string {
  const p = Math.round(paise ?? 0);
  return (p % 100 === 0 ? inrWhole : inrPaise).format(p / 100);
}

export function formatINRCompact(paise: number | null | undefined): string {
  return inrCompact.format((paise ?? 0) / 100);
}

/** GST on a subtotal, rounded to the nearest paisa. */
export function computeTax(subtotalPaise: number, gstRateBp: number): number {
  return Math.round((subtotalPaise * gstRateBp) / 10000);
}

export function plural(n: number, word: string) {
  return `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
