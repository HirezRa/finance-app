import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { AppVersion } from './AppVersion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Settings,
  Wallet,
  Tags,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { useAuthStore } from '@/store/auth.store';
import AlertsDropdown from '@/components/AlertsDropdown';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'עסקאות' },
  { to: '/budgets', icon: PiggyBank, label: 'תקציבים' },
  { to: '/accounts', icon: Wallet, label: 'חשבונות' },
  { to: '/categories', icon: Tags, label: 'קטגוריות' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={cn(
        'hidden h-screen flex-col border-sidebar-border bg-sidebar text-sidebar-foreground md:flex',
        'border-e transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isCollapsed ? (
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
              <span className="text-lg font-bold text-sidebar-primary-foreground">₪</span>
            </div>
            <span className="truncate text-lg font-bold">ניהול פיננסי</span>
          </Link>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label={isCollapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-end gap-1 border-b border-sidebar-border px-2 py-2">
        <AlertsDropdown />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed ? <span className="font-medium">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'space-y-3 border-t border-sidebar-border p-4',
          isCollapsed && 'px-2',
        )}
      >
        <div
          className={cn(
            'flex items-center',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!isCollapsed ? (
            <span className="text-sm text-sidebar-foreground/70">ערכת נושא</span>
          ) : null}
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent" />
        </div>

        {!isCollapsed && user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                <User className="h-4 w-4" />
              </div>
              <span className="max-w-[120px] truncate text-sm font-medium">
                {user.name || user.email}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleLogout}
              className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="התנתק"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {isCollapsed ? (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleLogout}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="התנתק"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        <AppVersion
          className={cn('text-sidebar-foreground/50', isCollapsed && 'text-center')}
        />
      </div>
    </aside>
  );
}
