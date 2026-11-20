"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/client";

/** Bottom sheet on phones, centered dialog on larger screens. Closes on Esc / backdrop. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  className,
  light,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  light?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t p-5 shadow-2xl animate-slide-up sm:max-w-md sm:rounded-3xl sm:border",
          light ? "border-cream-300 bg-white text-stone-900" : "border-amber-500/25 bg-espresso-900 text-stone-100",
          className,
        )}
      >
        <div className={cn("mx-auto mb-3 h-1.5 w-10 rounded-full sm:hidden", light ? "bg-stone-300" : "bg-stone-700")} />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="min-w-0">
              <h3 className="font-display text-lg font-extrabold leading-tight">{title}</h3>
              {subtitle && <p className={cn("text-xs", light ? "text-stone-500" : "text-stone-400")}>{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={cn("grid size-8 shrink-0 place-items-center rounded-full", light ? "bg-stone-100 text-stone-500 hover:text-stone-900" : "bg-espresso-800 text-stone-400 hover:text-white")}>
            <X className="size-4" />
          </button>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">{children}</div>
        {footer && <div className="pt-3">{footer}</div>}
      </div>
    </div>
  );
}
