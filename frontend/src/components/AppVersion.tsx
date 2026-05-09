import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { cn } from '@/lib/utils';

type VersionPayload = {
  version: string;
  coreVersion?: string;
  scraperAddOn?: string;
};

export function AppVersion({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['version'],
    queryFn: () => api.get<VersionPayload>('/version').then((res) => res.data),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  if (!data?.version) return null;

  const core = data.coreVersion ?? data.version;
  const addOn =
    data.scraperAddOn && data.scraperAddOn !== 'unknown'
      ? data.scraperAddOn
      : '—';

  return (
    <div
      className={cn(
        'px-3 text-center text-xs text-muted-foreground/60 space-y-0.5 leading-snug',
        className,
      )}
    >
      <div className="block">גירסת ליבה : {core}</div>
      <div className="block">מספר תוסף : {addOn}</div>
    </div>
  );
}
