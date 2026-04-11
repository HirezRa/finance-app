import { useState } from 'react';
import { Bell, Check, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface AlertItem {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt?: string;
  isRead: boolean;
}

function getAlertIcon(alert: AlertItem) {
  switch (alert.severity) {
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-expense" />;
    default:
      if (alert.type === 'weekly_summary') {
        return <CheckCircle className="h-4 w-4 text-income" />;
      }
      return <Info className="h-4 w-4 text-primary" />;
  }
}

export default function AlertsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.getAll().then((res) => res.data as AlertItem[]),
    refetchInterval: 60_000,
  });

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => alertsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => alertsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="התראות">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <Badge className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center bg-expense p-0 text-[10px] text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        className="w-80 max-h-[70vh] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="font-semibold">התראות</h3>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={markAllAsReadMutation.isPending}
              onClick={() => markAllAsReadMutation.mutate()}
            >
              <Check className="me-1 h-3 w-3" />
              סמן הכל כנקרא
            </Button>
          ) : null}
        </div>

        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">אין התראות חדשות</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.slice(0, 10).map((alert) => (
                <li
                  key={alert.id}
                  className={cn(
                    'cursor-pointer p-3 transition-colors hover:bg-muted/50',
                    !alert.isRead && 'bg-primary/5',
                  )}
                  onClick={() => {
                    if (!alert.isRead) markAsReadMutation.mutate(alert.id);
                  }}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">{getAlertIcon(alert)}</div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium', alert.isRead && 'font-normal')}>
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{alert.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {alert.createdAt
                          ? formatDistanceToNow(new Date(alert.createdAt), {
                              addSuffix: true,
                              locale: he,
                            })
                          : null}
                      </p>
                    </div>
                    {!alert.isRead ? (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {alerts.length > 10 ? (
          <div className="border-t border-border p-2 text-center">
            <Button type="button" variant="ghost" size="sm" className="text-xs">
              הצג את כל ההתראות
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
