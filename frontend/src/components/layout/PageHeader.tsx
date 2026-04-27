import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  sticky = true,
}: PageHeaderProps) {
  return (
    <header
      className={[
        sticky ? 'sticky top-0 z-20' : '',
        'mb-6 -mx-4 border-b border-white/5 bg-gradient-to-b from-slate-900/95 to-slate-900/80 px-4 py-4 backdrop-blur-lg md:-mx-6 md:px-6',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
