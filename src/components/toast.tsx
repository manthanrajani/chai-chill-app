"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

type Tone = "success" | "error" | "info" | "warning";
type Toast = { id: number; title: string; body?: string; tone: Tone };

const Ctx = createContext<(title: string, opts?: { body?: string; tone?: Tone }) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

const ICON = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const STYLE = {
  success: "border-emerald-500/50 text-emerald-300",
  error: "border-rose-500/50 text-rose-300",
  info: "border-sky-500/50 text-sky-300",
  warning: "border-amber-500/50 text-amber-300",
};

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((title: string, opts?: { body?: string; tone?: Tone }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, title, body: opts?.body, tone: opts?.tone ?? "success" }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border bg-espresso-900/95 p-3 shadow-2xl backdrop-blur animate-pop ${STYLE[t.tone]}`}>
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold">{t.title}</div>
                {t.body && <div className="mt-0.5 text-xs text-stone-300">{t.body}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
