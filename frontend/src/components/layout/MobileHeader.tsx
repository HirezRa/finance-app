import { Menu, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import AlertsDropdown from '@/components/AlertsDropdown';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'לוח בקרה',
  '/transactions': 'עסקאות',
  '/accounts': 'חשבונות',
  '/budgets': 'תקציבים',
  '/categories': 'קטגוריות',
  '/settings': 'הגדרות',
};

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'ניהול פיננסי';

  return (
    <header className="safe-area-inset-top fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-white/10 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label="פתח תפריט"
        >
          <Menu className="h-6 w-6" />
        </button>

        <h1 className="font-semibold text-foreground">{title}</h1>

        <div className="relative">
          <AlertsDropdown />
          <Bell className="pointer-events-none absolute -top-1 -end-1 h-3 w-3 text-transparent" />
        </div>
      </div>
    </header>
  );
}
