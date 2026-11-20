"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LegacyRedirect({ code }: { code: string }) {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/table/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { table?: { number: number } } | null) => {
        if (cancelled) return;
        if (!d?.table) return router.replace("/tables");
        const tab = params.get("tab");
        const open = params.get("open");
        const section =
          tab === "games" ? "/play" : tab === "orders" ? "/orders" : open && ["waiter", "bill", "wifi"].includes(open) ? `/${open}` : "";
        router.replace(`/table/${d.table.number}${section}`);
      })
      .catch(() => {
        if (!cancelled) router.replace("/tables");
      });
    return () => {
      cancelled = true;
    };
  }, [code, params, router]);
  return (
    <main className="grid flex-1 place-items-center">
      <Loader2 className="size-7 animate-spin text-brand-600" />
    </main>
  );
}
