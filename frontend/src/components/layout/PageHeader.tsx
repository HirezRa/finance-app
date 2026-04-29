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
        'mb-6 -mx-4 border-b border-white/15 bg-white/25 px-4 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] md:-mx-6 md:px-6',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground drop-shadow-sm">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
