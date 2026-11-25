"use client";

import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export function Select({
  label,
  hint,
  error,
  id,
  className = "",
  containerClassName = "",
  children,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label ? (
        <label
          htmlFor={selectId}
          className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-h-11 w-full appearance-none rounded-[10px] border bg-surface py-2 pl-3.5 pr-10 text-[16px] text-ink transition-colors focus:border-fire focus:outline-none focus:ring-2 focus:ring-fire/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-ink-muted ${
            error ? "border-fire" : "border-line"
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
      </div>
      {hint ? (
        <p id={hintId} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] font-semibold text-fire-soft">
          {error}
        </p>
      ) : null}
    </div>
  );
}
