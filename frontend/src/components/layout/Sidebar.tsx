import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Tags,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppVersion } from '@/components/AppVersion';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}

const navItems = [
  { path: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/transactions', label: 'עסקאות', icon: Receipt },
  { path: '/accounts', label: 'חשבונות', icon: Wallet },
  { path: '/budgets', label: 'תקציבים', icon: PiggyBank },
  { path: '/categories', label: 'קטגוריות', icon: Tags },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

export function Sidebar({ collapsed, onToggle, mobile }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-s border-sidebar-border bg-sidebar text-sidebar-foreground',
        !mobile && 'sticky top-0 h-screen shrink-0',
        collapsed && !mobile ? 'w-20' : 'w-64',
        mobile && 'h-full w-64',
        'transition-all duration-300',
      )}
    >
      <div className="flex items-center justify-between border-b border-sidebar-border p-4">
        {!collapsed || mobile ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar-accent">
              <span className="text-sm font-semibold text-sidebar-accent-foreground">₪</span>
            </div>
            <span className="truncate font-semibold tracking-tight">ניהול פיננסי</span>
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={onToggle}
          className="cursor-pointer rounded-sm p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={mobile ? 'סגור תפריט' : collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        >
          {mobile ? (
            <X className="h-5 w-5" />
          ) : collapsed ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="hide-scrollbar flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
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
                  'flex cursor-pointer items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 transition-colors duration-200',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive
                    ? 'border-border bg-sidebar-accent font-medium text-sidebar-foreground'
                    : 'text-muted-foreground',
                  collapsed && !mobile && 'justify-center',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-sidebar-foreground')} />
                {!collapsed || mobile ? (
                  <span className="font-medium">{item.label}</span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className={cn('flex items-center', collapsed && !mobile ? 'justify-center' : 'justify-between')}>
          {!collapsed || mobile ? (
            <span className="text-sm text-muted-foreground">ערכת נושא</span>
          ) : null}
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent" />
        </div>

        <div
          className={cn(
            'flex items-center gap-3 rounded-sm border border-sidebar-border bg-sidebar-accent/50 p-3',
            collapsed && !mobile && 'justify-center',
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar">
            <User className="h-4 w-4" />
          </div>
          {!collapsed || mobile ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name || user?.email || 'משתמש'}</p>
              <AppVersion className="px-0 text-start" />
            </div>
          ) : null}
          {collapsed && !mobile ? <AppVersion className="hidden" /> : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size={collapsed && !mobile ? 'icon' : 'sm'}
          onClick={handleLogout}
          className={cn(
            'w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed && !mobile && 'w-9',
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed || mobile ? <span>התנתק</span> : null}
        </Button>
      </div>
    </aside>
  );
}
