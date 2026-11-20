"use client";

import { useCallback, useSyncExternalStore } from "react";

/** localStorage-backed state that is SSR-safe and syncs across tabs. Values are JSON. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function usePersistentState<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {}
  }
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const cur = read(key);
      let prev = fallback;
      if (cur !== null) try { prev = JSON.parse(cur) as T; } catch {}
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
      listeners.forEach((l) => l());
    },
    // fallback is treated as constant per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set] as const;
}
