import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import "./Button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`btn btn--${variant} btn--${size} ${className}`.trim()} {...rest}>
      {Icon ? <Icon className="btn__icon" size={size === "sm" ? 13 : 15} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
