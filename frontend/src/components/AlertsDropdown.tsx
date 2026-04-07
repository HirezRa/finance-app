import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { alertsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  RefreshCw,
} from 'lucide-react';

interface AlertItem {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt?: string;
  isRead: boolean;
}

export default function AlertsDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.getAll().then((res) => res.data as AlertItem[]),
    refetchInterval: 60_000,
  });

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label="התראות"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="סגור"
            onClick={() => setIsOpen(false)}
          />

          <Card className="absolute end-0 top-full z-50 mt-2 w-80 max-h-96 overflow-hidden shadow-lg">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="font-semibold">התראות</h3>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => void refetch()}
                  aria-label="רענן"
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                  aria-label="סגור"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">אין התראות</p>
                </div>
              ) : (
                <div className="divide-y">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'border-s-2 p-3 transition-colors hover:bg-muted/50',
                        getSeverityBg(alert.severity),
                      )}
                    >
                      <div className="flex gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
