"use client";

import { useSyncExternalStore } from "react";
import useSWR from "swr";
import { fetcher } from "./client";
import { usePersistentState } from "./use-persistent";

const noop = () => () => {};

export function isLocalUrl(u: string) {
  return /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u);
}

/**
 * Website address printed in table QR codes.
 * 1. whatever the owner saved, else
 * 2. the current site — unless it's "localhost" (phones can't open that), then this computer's Wi-Fi address.
 */
export function useBaseUrl() {
  const [saved, setSaved] = usePersistentState<string>("cc:qr-base", "");
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const lan = useSWR<{ urls: string[] }>(origin && isLocalUrl(origin) ? "/api/admin/network" : null, fetcher);
  const auto = isLocalUrl(origin) && lan.data?.urls[0] ? lan.data.urls[0] : origin;
  const save = (v: string) => setSaved(v.trim().replace(/\/+$/, ""));
  return { url: saved || auto, saved, auto, lanUrls: lan.data?.urls ?? [], save } as const;
}
