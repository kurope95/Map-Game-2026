import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import type { CountryId } from "../../game/state/types";
import { Flag } from "./Flag";
import "./Window.css";

interface WindowProps {
  title: ReactNode;
  icon?: LucideIcon;
  flag?: CountryId;
  actions?: ReactNode;
  onClose?: () => void;
  onBackdropClick?: () => void;
  variant?: "panel" | "modal" | "popup";
  className?: string;
  backdropClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  layoutId?: string;
  children: ReactNode;
}

export function Window({
  title,
  icon: Icon,
  flag,
  actions,
  onClose,
  onBackdropClick,
  variant = "panel",
  className = "",
  backdropClassName = "",
  bodyClassName = "",
  footer,
  layoutId,
  children
}: WindowProps) {
  const windowElement = (
    <section
      className={`win win--${variant} ${className}`.trim()}
      data-layout={layoutId}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="win__header">
        {flag ? <Flag countryId={flag} width={18} /> : null}
        {!flag && Icon ? <Icon className="win__icon" size={16} aria-hidden="true" /> : null}
        <h2 className="win__title">{title}</h2>
        {actions ? <div className="win__actions">{actions}</div> : null}
        {onClose ? (
          <button type="button" className="win__close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        ) : null}
      </header>
      <div className={`win__body ${bodyClassName}`.trim()}>{children}</div>
      {footer ? <footer className="win__footer">{footer}</footer> : null}
    </section>
  );

  if (variant !== "modal") {
    return windowElement;
  }

  return (
    <div
      className={`win-backdrop ${backdropClassName}`.trim()}
      data-layout={layoutId ? `${layoutId}-backdrop` : undefined}
      onClick={onBackdropClick ?? onClose}
    >
      {windowElement}
    </div>
  );
}
