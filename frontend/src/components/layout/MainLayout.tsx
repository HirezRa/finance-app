import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function MainLayout() {
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [location.pathname, isMobile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {isMobile ? (
        <MobileHeader onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)} />
      ) : null}

      <div className="flex h-screen">
        {!isMobile ? (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        ) : null}

        <main
          className={[
            'flex-1 overflow-x-hidden overflow-y-auto',
            isMobile ? 'pb-20 pt-16' : 'p-6',
          ].join(' ')}
        >
          <div className={isMobile ? 'mx-auto px-4' : 'mx-auto max-w-7xl'}>
            <Outlet />
          </div>
        </main>

        {isMobile && !sidebarCollapsed ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
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

        {isMobile ? <BottomNav /> : null}
      </div>
    </div>
  );
}
