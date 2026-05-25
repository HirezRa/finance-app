import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BentoDashboard } from '@/components/dashboard/bento/BentoDashboard';
import { BrutalistDashboard } from '@/components/dashboard/brutal/BrutalistDashboard';
import { useDashboardData } from '@/components/dashboard/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const isBento = useMediaQuery('(min-width: 1024px)');
  const data = useDashboardData();

  if (data.isLoading && !data.summary) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return isBento ? <BentoDashboard data={data} /> : <BrutalistDashboard data={data} />;
}
