import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import AlertsDropdown from '@/components/AlertsDropdown';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen-safe min-h-screen bg-transparent">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-area-inset-top sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/15 bg-white/45 px-4 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] md:hidden">
          <span className="font-semibold text-foreground">ניהול פיננסי</span>
          <AlertsDropdown />
        </header>

        <main className="flex-1 overflow-auto pb-20 pt-0 md:pb-0 md:pt-0">
          <div className="container mx-auto max-w-7xl px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
