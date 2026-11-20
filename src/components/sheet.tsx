"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/client";

/** Bottom sheet on phones, centered dialog on larger screens. Closes on Esc / backdrop. Light by default; `dark` for the kitchen. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  className,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  dark?: boolean;
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
    <div
      className={cn("fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[3px] animate-fade-in sm:items-center sm:p-4", dark ? "bg-black/70" : "bg-ink/40")}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[90dvh] w-full flex-col rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up sm:max-w-md sm:rounded-[28px]",
          dark ? "border border-espresso-700 bg-espresso-900 text-stone-100 shadow-2xl" : "bg-white text-ink shadow-lift",
          className,
        )}
      >
        <div className={cn("mx-auto -mt-1 mb-3 h-1.5 w-11 rounded-full sm:hidden", dark ? "bg-espresso-700" : "bg-line-2")} />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="min-w-0">
              <h3 className={cn("text-xl font-semibold leading-tight", dark ? "font-display font-extrabold" : "font-serif")}>{title}</h3>
              {subtitle && <p className={cn("mt-0.5 text-xs", dark ? "text-stone-400" : "text-ink-3")}>{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={cn("press grid size-9 shrink-0 place-items-center rounded-full transition", dark ? "bg-espresso-800 text-stone-400 hover:text-white" : "bg-sand text-ink-2 hover:bg-sand-2 hover:text-ink")}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">{children}</div>
        {footer && <div className="pt-4">{footer}</div>}
      </div>
    </div>
  );
}
