import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';

export interface CategoryWithTargetStats {
  id: string;
  nameHe: string;
  icon?: string | null;
  color?: string | null;
  monthlyTarget: number | null;
  spent: number;
  remaining: number | null;
  percentUsed: number | null;
  isOverBudget: boolean;
}

interface TrackedCategoriesProps {
  categories: CategoryWithTargetStats[];
  isLoading?: boolean;
}

export function TrackedCategories({ categories, isLoading }: TrackedCategoriesProps) {
  const trackedCategories = categories.filter(
    (c) => c.monthlyTarget !== null && c.monthlyTarget > 0,
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>קטגוריות במעקב</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse text-muted-foreground">טוען...</div>
        </CardContent>
      </Card>
    );
  }

  if (trackedCategories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>קטגוריות במעקב</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            אין קטגוריות עם יעד חודשי.
            <br />
            בדף קטגוריות ניתן להגדיר יעד לקטגוריות שתרצה לעקוב אחריהן.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>קטגוריות במעקב</span>
          <span className="text-sm font-normal text-muted-foreground">
            {trackedCategories.length} קטגוריות
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {trackedCategories.map((category) => (
          <div key={category.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span>{category.icon ?? '❓'}</span>
                <span className="truncate font-medium">{category.nameHe}</span>
              </div>
              <div className="shrink-0 text-sm tabular-nums">
                <span
                  className={cn(
                    category.isOverBudget ? 'text-red-500' : 'text-muted-foreground',
                  )}
                >
                  {formatCurrency(category.spent)}
                </span>
                <span className="text-muted-foreground"> / </span>
                <span>{formatCurrency(category.monthlyTarget!)}</span>
              </div>
            </div>

            <Progress
              value={Math.min(category.percentUsed ?? 0, 100)}
              className={cn(
                'h-2',
                category.isOverBudget && '[&>div]:bg-red-500',
              )}
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {category.isOverBudget
                  ? `חריגה של ${formatCurrency(Math.abs(category.remaining!))}`
                  : `נותרו ${formatCurrency(category.remaining!)}`}
              </span>
              <span>{category.percentUsed ?? 0}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
