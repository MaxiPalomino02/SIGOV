import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseClasses =
  "inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 rounded-[10px] whitespace-nowrap font-semibold leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-fire text-ink shadow-[0_0_18px_rgba(198,40,40,0.22)] hover:bg-fire-dark active:bg-fire-dark",
  secondary:
    "border border-line bg-surface text-ink shadow-[0_1px_0_rgba(255,255,255,0.03)] hover:border-ink-muted/40 hover:bg-surface-hover",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-hover hover:text-ink",
  danger:
    "border border-fire-border bg-fire-light text-fire-text hover:bg-fire/20 active:bg-fire/20",
  outline:
    "border border-fire bg-surface text-fire hover:bg-fire hover:text-surface active:bg-fire",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-11 px-3 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[15px]",
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
