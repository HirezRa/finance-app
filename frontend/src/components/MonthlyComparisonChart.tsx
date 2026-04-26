import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export interface HistoryItem {
  month: number;
  year: number;
  label: string;
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
}

interface MonthlyComparisonChartProps {
  data: HistoryItem[];
  isLoading?: boolean;
}

export function MonthlyComparisonChart({ data, isLoading }: MonthlyComparisonChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      name: item.label,
      הכנסות: item.income,
      הוצאות: item.expenses,
      יתרה: item.balance,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>השוואה בין חודשים</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <div className="animate-pulse text-muted-foreground">טוען...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>השוואה בין חודשים</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">אין נתונים להצגה</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>השוואה בין חודשים</span>
          <span className="text-sm font-normal text-muted-foreground">
            {data.length} מחזורים אחרונים
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <defs>
              <linearGradient id="mcIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="mcExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.82)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                color: 'rgba(255,255,255,0.95)',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Bar dataKey="הכנסות" fill="url(#mcIncome)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="הוצאות" fill="url(#mcExpense)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
