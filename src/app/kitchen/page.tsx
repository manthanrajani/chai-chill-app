import { Suspense } from "react";
import type { Metadata } from "next";
import { KitchenApp } from "./kitchen-app";

export const metadata: Metadata = { title: "Kitchen & Floor" };

export default function KitchenPage() {
  return (
    <Suspense fallback={<div className="p-6 text-stone-400">Loading kitchen screen…</div>}>
      <KitchenApp />
    </Suspense>
  );
}
