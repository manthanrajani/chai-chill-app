"use client";

import { useEffect, useState } from "react";

/** Client-side fetch helpers shared by every screen. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each screen declares its own response type
async function parse(res: Response): Promise<any> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    // body cut off (navigating away, flaky Wi-Fi) or not JSON — report it as a failure so SWR retries,
    // never hand screens an empty object
    throw new HttpError(res.ok ? 0 : res.status, res.ok ? "Connection interrupted — retrying…" : `Request failed (${res.status})`);
  }
  if (!res.ok) throw new HttpError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return data;
}

export const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(parse);

export async function api<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE" | "PUT", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parse(res) as Promise<T>;
}

export function timeAgo(iso: string | Date, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function minutesSince(iso: string | Date, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function clockTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}


/** Current time that re-renders every `ms` (for countdowns / "x min ago"). */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
