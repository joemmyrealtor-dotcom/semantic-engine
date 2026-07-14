import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          {eyebrow && <div className="text-[11px] tracking-[0.22em] uppercase text-gold font-medium mb-2">{eyebrow}</div>}
          <h1 className="font-serif text-2xl md:text-3xl text-heritage leading-tight">{title}</h1>
          {description && <p className="text-sm text-slate-ink mt-2 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">{children}</div>;
}
