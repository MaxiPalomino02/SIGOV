"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type HojaProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Hoja({
  open,
  onClose,
  title,
  children,
  footer,
  className = "",
}: HojaProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const nodos = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const primero = nodos && nodos.length > 0 ? nodos[0] : panel;
    primero?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const enfocables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!panel || !enfocables || enfocables.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const primerNodo = enfocables[0];
      const ultimoNodo = enfocables[enfocables.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? ultimoNodo : primerNodo).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === primerNodo) {
        event.preventDefault();
        ultimoNodo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimoNodo) {
        event.preventDefault();
        primerNodo.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflowOriginal;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
          className="absolute inset-0 bg-bg/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t-4 border-fire bg-surface shadow-[0_-18px_56px_rgba(0,0,0,0.55)] animate-slide-up focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:border-l-4 sm:border-t-0 sm:animate-fade-in ${className}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="heading-display text-xl text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-[16px] leading-relaxed text-ink">
          {children}
        </div>
        {footer ? (
          <footer className="border-t border-line px-5 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
