import { randomBytes } from "crypto";

export const ONLINE_WINDOW_MS = 90_000;

/** Unguessable 10-char code printed in each table's QR link. */
export function newTableCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type FloorStatus = "vacant" | "online" | "seated" | "food" | "attention";

export function deriveFloorStatus(input: {
  openRequests: number;
  activeOrders: number;
  hasOpenBill: boolean;
  lastSeenAt: Date | null;
}): FloorStatus {
  if (input.openRequests > 0) return "attention";
  if (input.activeOrders > 0) return "food";
  if (input.hasOpenBill) return "seated";
  if (input.lastSeenAt && Date.now() - input.lastSeenAt.getTime() < ONLINE_WINDOW_MS) return "online";
  return "vacant";
}
