import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export function AppVersion({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['version'],
    queryFn: () => api.get<{ version: string }>('/version').then((res) => res.data),
    staleTime: Infinity,
    retry: false,
  });

  if (!data?.version) return null;

  return (
    <div
      className={cn('px-3 text-center text-xs text-muted-foreground/60', className)}
    >
      גרסה {data.version}
    </div>
  );
}
