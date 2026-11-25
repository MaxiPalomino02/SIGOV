"use client";

import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export function Textarea({
  label,
  hint,
  error,
  id,
  className = "",
  containerClassName = "",
  ...props
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label ? (
        <label
          htmlFor={textareaId}
          className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted"
        >
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-28 w-full resize-y rounded-[10px] border bg-surface px-3.5 py-3 text-[16px] leading-relaxed text-ink placeholder:text-ink-faint transition-colors focus:border-fire focus:outline-none focus:ring-2 focus:ring-fire/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-ink-muted ${
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
