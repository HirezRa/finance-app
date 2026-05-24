import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function MainLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobileLayout = useMediaQuery('(max-width: 1023px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isMobileLayout) {
      setSidebarCollapsed(true);
    }
  }, [location.pathname, isMobileLayout]);

  if (isDashboard) {
    return (
      <main className="h-dvh overflow-hidden">
        <Outlet />
      </main>
    );
  }

  return (
    <div
      className={
        isDesktop
          ? 'app-shell-bento min-h-screen'
          : 'min-h-screen bg-[var(--brutal-bg)]'
      }
    >
      {isMobileLayout ? (
        <MobileHeader onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)} />
      ) : null}

      <div className="flex h-screen">
        {isDesktop ? (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        ) : null}

        <main
          className={[
            'flex-1 overflow-x-hidden overflow-y-auto',
            isMobileLayout ? 'pb-20 pt-16' : 'p-7',
          ].join(' ')}
        >
          <div className={isMobileLayout ? 'mx-auto px-4' : 'mx-auto max-w-7xl'}>
            <Outlet />
          </div>
        </main>

        {isMobileLayout && !sidebarCollapsed ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setSidebarCollapsed(true)}
            />
            <div className="fixed right-0 top-0 z-50 h-full w-64">
              <Sidebar
                collapsed={false}
                onToggle={() => setSidebarCollapsed(true)}
                mobile
              />
            </div>
          </>
        ) : null}

        {isMobileLayout ? <BottomNav /> : null}
      </div>
    </div>
  );
}
