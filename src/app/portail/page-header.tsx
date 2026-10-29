import type { ReactNode } from "react";

type PortalPageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
};

export function PortalPageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
}: PortalPageHeaderProps) {
  return (
    <header className="portal-page-header">
      <p className="portal-page-header-kicker">{eyebrow}</p>
      <div className="portal-page-header-row">
        <div className="portal-page-header-copy">
          <h1>{title}</h1>
          <p>{description}</p>
          {meta ? <p className="portal-page-header-meta">{meta}</p> : null}
        </div>
        {action ? <div className="portal-page-header-action">{action}</div> : null}
      </div>
    </header>
  );
}