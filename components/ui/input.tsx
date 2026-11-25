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
    <div className={`flex flex-col gap-2 ${containerClassName}`}>
      {label ? (
        <label htmlFor={inputId} className="text-[15px] text-label-2">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-[50px] w-full rounded-[14px] border border-separator bg-surface-2 px-4 text-[17px] text-label placeholder:text-label-3 transition-colors focus:border-red focus:outline-2 focus:outline-offset-2 focus:outline-red disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
