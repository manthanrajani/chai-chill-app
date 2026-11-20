import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminShell } from "./shell";

export const metadata: Metadata = { title: "Owner dashboard" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
