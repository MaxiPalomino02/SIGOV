"use client";

import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export type TabItem = {
  value: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

export function Tabs({
  items,
  value,
  onChange,
  ariaLabel = "Secciones",
  className = "",
}: TabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const actual = items.findIndex((item) => item.value === value);
    let siguiente = actual;
    if (event.key === "ArrowRight") siguiente = (actual + 1) % items.length;
    if (event.key === "ArrowLeft") siguiente = (actual - 1 + items.length) % items.length;
    if (event.key === "Home") siguiente = 0;
    if (event.key === "End") siguiente = items.length - 1;
    const item = items[siguiente];
    if (!item) return;
    onChange(item.value);
    const botones = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    botones[siguiente]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-1 overflow-x-auto border-b border-separator ${className}`}
    >
      {items.map((item) => {
        const activo = item.value === value;
        const Icono = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={`tap relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-[14px] px-3.5 text-[15px] font-semibold transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
              activo
                ? "bg-red-tint text-label ring-1 ring-inset ring-red"
                : "text-label-2 hover:bg-surface-2 hover:text-label"
            }`}
          >
            {Icono ? (
              <Icono
                className={`h-4 w-4 ${
                  activo ? "text-red" : "text-label-2"
                }`}
                aria-hidden
              />
            ) : null}
            <span>{item.label}</span>
            {item.badge !== undefined ? (
              <span className="num rounded-full bg-separator px-2 py-0.5 text-[12px] font-bold text-label">
                {item.badge}
              </span>
            ) : null}
            {activo ? (
              <span
                aria-hidden
                className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-red animate-fade-in"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
