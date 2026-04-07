import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncProgressStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncProgressProps {
  isOpen: boolean;
  onClose: () => void;
  status: SyncProgressStatus;
  progress: number;
  message: string;
  details?: string;
}

export function SyncProgress({
  isOpen,
  onClose,
  status,
  progress,
  message,
  details,
}: SyncProgressProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-4">
            {status === 'syncing' ? (
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            ) : null}
            {status === 'success' ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : null}
            {status === 'error' ? <XCircle className="h-8 w-8 text-red-500" /> : null}
            <div>
              <h3 className="text-lg font-semibold">{message}</h3>
              {details ? <p className="text-sm text-muted-foreground">{details}</p> : null}
            </div>
          </div>

          {status === 'syncing' ? (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-center text-sm text-muted-foreground">{progress}%</p>
            </div>
          ) : null}

          {status === 'success' || status === 'error' ? (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'mt-4 w-full rounded-lg py-2 font-medium',
                status === 'success'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700',
              )}
            >
              סגור
            </button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
