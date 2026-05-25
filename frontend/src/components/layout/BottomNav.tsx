import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MOBILE_BOTTOM_NAV } from '@/config/navigation';

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="safe-area-pb fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--panel)] lg:hidden"
      aria-label="ניווט ראשי"
    >
      <div className="flex h-16 items-center justify-around">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-sm px-2 py-2 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]',
                item.main && '-mt-3',
                isActive ? 'text-[var(--fg)]' : 'text-[var(--dim)] hover:text-[var(--fg)]',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center',
                  item.main &&
                    'h-12 w-12 rounded-full border border-[var(--accent-primary-border)] text-white',
                  !item.main && 'h-8 w-8',
                )}
                style={
                  item.main
                    ? { background: 'var(--accent-gradient)' }
                    : undefined
                }
              >
                <Icon className={cn('h-5 w-5', item.main && 'h-6 w-6')} aria-hidden />
              </div>
              <span className={cn('text-xs', item.main && 'font-medium')}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
