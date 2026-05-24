import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BentoDashboard } from '@/components/dashboard/bento/BentoDashboard';
import { BrutalistDashboard } from '@/components/dashboard/brutal/BrutalistDashboard';

export default function DashboardPage() {
  const isBento = useMediaQuery('(min-width: 1024px)');

  return isBento ? <BentoDashboard /> : <BrutalistDashboard />;
}
