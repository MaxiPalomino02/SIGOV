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
    <div className={`flex flex-col gap-2 ${containerClassName}`}>
      {label ? (
        <label htmlFor={textareaId} className="text-[15px] text-label-2">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-28 w-full resize-y rounded-[14px] border border-separator bg-surface-2 px-4 py-3 text-[17px] leading-relaxed text-label placeholder:text-label-3 transition-colors focus:border-red focus:outline-2 focus:outline-offset-2 focus:outline-red disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-[13px] text-label-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] font-semibold text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
