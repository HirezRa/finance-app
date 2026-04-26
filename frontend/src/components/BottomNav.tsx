import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Settings,
  Wallet,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'עסקאות' },
  { to: '/budgets', icon: PiggyBank, label: 'תקציבים' },
  { to: '/accounts', icon: Wallet, label: 'חשבונות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="safe-area-inset-bottom fixed bottom-0 start-0 end-0 z-50 border-t border-white/15 bg-white/55 shadow-[0_-8px_32px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.08] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.35)] md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors',
                'touch-manipulation active:scale-95',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5 transition-all', isActive && 'scale-110')} />
              <span
                className={cn('text-[10px] font-medium', isActive && 'font-semibold')}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
