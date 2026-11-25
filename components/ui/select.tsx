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
    <div className={`flex flex-col gap-2 ${containerClassName}`}>
      {label ? (
        <label htmlFor={selectId} className="text-[15px] text-label-2">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-h-[50px] w-full appearance-none rounded-[14px] border border-separator bg-surface-2 py-3 pl-4 pr-11 text-[17px] text-label transition-colors focus:border-red focus:outline-2 focus:outline-offset-2 focus:outline-red disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={22}
          strokeWidth={1.75}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-label-3"
          aria-hidden
        />
      </div>
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
