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
    <nav className="safe-area-inset-bottom fixed bottom-0 start-0 end-0 z-50 border-t border-border bg-card md:hidden">
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
                'flex h-full flex-1 flex-col cursor-pointer items-center justify-center gap-1 transition-colors duration-200',
                'touch-manipulation',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
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
