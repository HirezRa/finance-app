import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/settings', label: 'הגדרות', icon: Settings },
  { path: '/budgets', label: 'תקציבים', icon: PiggyBank },
  { path: '/dashboard', label: 'בית', icon: LayoutDashboard, main: true },
  { path: '/accounts', label: 'חשבונות', icon: Wallet },
  { path: '/transactions', label: 'עסקאות', icon: Receipt },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="safe-area-pb fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-white/30 shadow-[0_-8px_32px_rgb(15_23_42_/0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.08] dark:shadow-[0_-8px_32px_rgb(0_0_0_/0.35)] md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-sm px-3 py-2 transition-colors duration-200',
                item.main && '-mt-3',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center',
                  item.main &&
                    'h-12 w-12 rounded-full border border-primary/30 bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/30',
                  !item.main && 'h-8 w-8',
                )}
              >
                <Icon className={cn('h-5 w-5', item.main && 'h-6 w-6')} />
              </div>
              <span className={cn('text-xs', item.main && 'font-medium')}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
