"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { api } from "@/lib/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { user } = await api<{ user: { role: "ADMIN" | "STAFF" } }>("/api/auth/login", "POST", { email, password });
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? (user.role === "ADMIN" ? "/admin" : "/kitchen"));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-brand-500/20 bg-white p-6 shadow-2xl animate-pop">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-brand-500 to-brand-600 text-2xl">☕</div>
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Staff sign in</h1>
          <p className="text-xs text-ink-2">Kitchen screen &amp; owner dashboard</p>
        </div>
      </div>
      <label className="block text-xs font-semibold text-ink-2">
        Email
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-sand px-3 py-3 text-sm text-ink outline-none focus:border-brand-500" />
      </label>
      <label className="mt-3 block text-xs font-semibold text-ink-2">
        Password
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-sand px-3 py-3 text-sm text-ink outline-none focus:border-brand-500" />
      </label>
      {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
      <button disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-extrabold text-white hover:bg-brand-700 disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Sign in
      </button>
    </form>
  );
}
