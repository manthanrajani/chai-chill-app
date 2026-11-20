"use client";

import { useState } from "react";
import useSWR from "swr";
import { KeyRound, Plus } from "lucide-react";
import { api, cn, fetcher } from "@/lib/client";
import { Btn, Card, Field, PageHeader, Toggle, inputCls } from "@/components/admin-ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";

type User = { id: string; name: string; email: string; role: "ADMIN" | "STAFF"; active: boolean; createdAt: string };

export default function StaffAdmin() {
  const toast = useToast();
  const { data, mutate } = useSWR<{ users: User[] }>("/api/admin/users", fetcher);
  const me = useSWR<{ user: { id: string } | null }>("/api/auth/me", fetcher);
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast(ok); mutate(); return true; } catch (e) { toast((e as Error).message, { tone: "error" }); return false; }
  }

  return (
    <div>
      <PageHeader
        title="Staff logins"
        subtitle="Staff can use the kitchen screen (orders, table requests, bills, sold-out). Admins also see sales and settings."
        actions={<Btn onClick={() => setAdding(true)}><Plus className="size-4" /> Add login</Btn>}
      />
      <Card>
        <div className="divide-y divide-cream-200">
          {data?.users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="grid size-10 place-items-center rounded-full bg-cream-200 font-bold">{u.name[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{u.name} {u.id === me.data?.user?.id && <span className="text-xs font-normal text-stone-500">(you)</span>}</div>
                <div className="truncate text-xs text-stone-500">{u.email}</div>
              </div>
              <select value={u.role} disabled={u.id === me.data?.user?.id} onChange={(e) => run(() => api(`/api/admin/users/${u.id}`, "PATCH", { role: e.target.value }), "Role updated")} className={cn(inputCls, "w-auto py-1.5")}>
                <option value="STAFF">Staff (kitchen)</option>
                <option value="ADMIN">Admin (owner)</option>
              </select>
              <Btn variant="ghost" onClick={() => setResetFor(u)}><KeyRound className="size-4" /> Password</Btn>
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                <Toggle checked={u.active} label="Active" onChange={(v) => u.id !== me.data?.user?.id && run(() => api(`/api/admin/users/${u.id}`, "PATCH", { active: v }), v ? "Login enabled" : "Login disabled")} />
                {u.active ? "Active" : "Disabled"}
              </label>
            </div>
          ))}
        </div>
      </Card>

      {adding && <AddUser onClose={() => setAdding(false)} onSave={async (d) => { if (await run(() => api("/api/admin/users", "POST", d), "Login created")) setAdding(false); }} />}
      {resetFor && (
        <ResetPassword user={resetFor} onClose={() => setResetFor(null)} onSave={async (password) => { if (await run(() => api(`/api/admin/users/${resetFor.id}`, "PATCH", { password }), "Password changed")) setResetFor(null); }} />
      )}
    </div>
  );
}

function AddUser({ onClose, onSave }: { onClose: () => void; onSave: (d: object) => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "STAFF" });
  return (
    <Sheet open onClose={onClose} title="Add staff login">
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <Field label="Name"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
        <Field label="Email (used to sign in)"><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
        <Field label="Password" hint="At least 8 characters"><input required minLength={8} type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} /></Field>
        <Field label="Role">
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputCls}>
            <option value="STAFF">Staff — kitchen screen only</option>
            <option value="ADMIN">Admin — everything incl. sales</option>
          </select>
        </Field>
        <Btn type="submit" className="mt-2">Create login</Btn>
      </form>
    </Sheet>
  );
}

function ResetPassword({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (p: string) => void }) {
  const [p, setP] = useState("");
  return (
    <Sheet open onClose={onClose} title={`New password for ${user.name}`}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave(p); }}>
        <Field label="New password" hint="At least 8 characters"><input required minLength={8} type="text" value={p} onChange={(e) => setP(e.target.value)} className={inputCls} /></Field>
        <Btn type="submit">Save password</Btn>
      </form>
    </Sheet>
  );
}
