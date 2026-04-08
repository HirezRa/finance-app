import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export function AppVersion() {
  const { data } = useQuery({
    queryKey: ['version'],
    queryFn: () => api.get<{ version: string }>('/version').then((res) => res.data),
    staleTime: Infinity,
    retry: false,
  });

  if (!data?.version) return null;

  return (
    <div className="px-3 text-center text-xs text-muted-foreground/60">
      גרסה {data.version}
    </div>
  );
}
