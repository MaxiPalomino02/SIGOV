"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export function Input({
  label,
  hint,
  error,
  id,
  className = "",
  containerClassName = "",
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink-faint transition-colors focus:border-fire focus:outline-none focus:ring-2 focus:ring-fire/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-ink-muted ${
          error ? "border-fire" : "border-line"
        } ${className}`}
        {...props}
      />
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
