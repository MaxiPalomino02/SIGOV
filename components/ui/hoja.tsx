"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
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

export function Hoja({ open, onClose, title, children, footer, className = "" }: HojaProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const tituloId = useId();

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default bg-label/40 backdrop-blur-[20px] animate-fade-in"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[20px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] animate-sheet-up focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red sm:max-w-lg sm:rounded-[20px] sm:shadow-[0_1px_2px_rgba(0,0,0,.04)] sm:animate-fade-in ${className}`}
      >
        <div aria-hidden className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-separator sm:hidden" />
        <header className="flex items-start justify-between gap-3 border-b border-separator px-5 py-4">
          <h2 id={tituloId} className="text-[22px] font-bold text-label">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-label-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
          >
            <X size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-[17px] leading-relaxed text-label">
          {children}
        </div>
        {footer ? <footer className="border-t border-separator px-5 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
