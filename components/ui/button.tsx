import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseClasses =
  "tap inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-semibold leading-none transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-red text-surface hover:bg-red-pressed",
  secondary: "border border-separator bg-surface text-red hover:bg-surface-2",
  ghost: "bg-transparent text-red hover:bg-red-tint",
  danger: "bg-red-tint text-red hover:bg-red hover:text-surface",
  outline: "border border-red bg-surface text-red hover:bg-red-tint",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-[15px]",
  md: "h-[50px] px-5 text-[17px]",
  lg: "h-[50px] px-6 text-[17px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
