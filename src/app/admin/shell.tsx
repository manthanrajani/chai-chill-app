"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { BarChart3, ChefHat, LogOut, Menu as MenuIcon, QrCode, ReceiptText, Settings, Soup, Users, X } from "lucide-react";
import { api, cn, fetcher } from "@/lib/client";
import { LiveAlerts } from "@/components/live-alerts";

const NAV = [
  { href: "/admin", label: "Sales dashboard", icon: BarChart3 },
  { href: "/admin/orders", label: "Orders & bills", icon: ReceiptText },
  { href: "/admin/menu", label: "Menu", icon: Soup },
  { href: "/admin/tables", label: "Tables & QR codes", icon: QrCode },
  { href: "/admin/staff", label: "Staff logins", icon: Users },
  { href: "/admin/settings", label: "Cafe settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const me = useSWR<{ user: { name: string; email: string } | null }>("/api/auth/me", fetcher);
  const settings = useSWR<{ settings: { cafeName: string } }>("/api/admin/settings", fetcher);

  // print pages render without the chrome
  if (path.startsWith("/admin/tables/print")) return <div className="flex-1 bg-white text-stone-900">{children}</div>;

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
            className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-espresso-900 text-brand-300" : "text-stone-600 hover:bg-cream-200 hover:text-stone-900")}>
            <Icon className="size-4" /> {n.label}
          </Link>
        );
      })}
      <Link href="/kitchen" className="mt-3 flex items-center gap-2.5 rounded-xl border border-cream-300 px-3 py-2.5 text-sm font-semibold text-stone-700 hover:border-brand-500">
        <ChefHat className="size-4 text-brand-600" /> Open kitchen screen
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-cream-100 text-stone-900 selection:bg-brand-200">
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-cream-300 bg-cream-50 p-4 lg:flex">
        <Brand name={settings.data?.settings.cafeName} />
        <div className="mt-6 flex-1">{nav}</div>
        <UserBox name={me.data?.user?.name} email={me.data?.user?.email} onLogout={async () => { await api("/api/auth/logout", "POST"); router.replace("/login"); }} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-cream-50 p-4 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Brand name={settings.data?.settings.cafeName} /><button onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button></div>
            <div className="mt-6 flex-1">{nav}</div>
            <UserBox name={me.data?.user?.name} email={me.data?.user?.email} onLogout={async () => { await api("/api/auth/logout", "POST"); router.replace("/login"); }} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-cream-300 bg-cream-50/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon className="size-5" /></button>
          <Brand name={settings.data?.settings.cafeName} />
        </header>
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-clip p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <LiveAlerts />
    </div>
  );
}

function Brand({ name }: { name?: string }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-brand-500 to-brand-600 text-lg">☕</div>
      <div>
        <div className="font-display text-sm font-extrabold leading-tight">{name ?? "Your cafe"}</div>
        <div className="text-[11px] text-stone-500">Owner dashboard</div>
      </div>
    </Link>
  );
}

function UserBox({ name, email, onLogout }: { name?: string; email?: string; onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-cream-300 bg-white p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{name ?? "…"}</div>
        <div className="truncate text-[11px] text-stone-500">{email}</div>
      </div>
      <button onClick={onLogout} className="rounded-lg p-2 text-stone-500 hover:bg-cream-100 hover:text-stone-900" title="Sign out"><LogOut className="size-4" /></button>
    </div>
  );
}
