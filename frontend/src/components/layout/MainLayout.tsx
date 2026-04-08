import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AlertsDropdown from '@/components/AlertsDropdown';
import { AppVersion } from '@/components/AppVersion';

const navItems = [
  { path: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/transactions', label: 'עסקאות', icon: Receipt },
  { path: '/accounts', label: 'חשבונות', icon: Wallet },
  { path: '/categories', label: 'קטגוריות', icon: Tag },
  { path: '/budgets', label: 'תקציבים', icon: PiggyBank },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-semibold">ניהול פיננסי</span>
        </div>
        <div className="ms-auto flex items-center gap-1">
          <AlertsDropdown />
        </div>
      </header>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          aria-label="סגור תפריט"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed top-0 z-[60] flex h-full w-64 flex-col border-l bg-background transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
          'right-0',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold">ניהול פיננסי</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden lg:block">
              <AlertsDropdown />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto shrink-0 border-t p-4">
          <AppVersion />
          <div className="mb-2 mt-2 truncate px-3 text-sm text-muted-foreground">
            {user?.name || user?.email}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            התנתק
          </Button>
        </div>
      </aside>

      <main className="lg:pr-64">
        <div className="container mx-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
