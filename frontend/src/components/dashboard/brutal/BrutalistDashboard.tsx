import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAchievements } from '@/hooks/useInsights';
import type { DashboardData } from '@/components/dashboard/hooks/useDashboardData';
import { AddTransactionModal } from '@/components/dashboard/AddTransactionModal';
import { scraperApi } from '@/services/api';
import { cn } from '@/lib/utils';

const BRUTAL_PALETTE: { bg: string; color?: string }[] = [
  { bg: 'var(--brutal-lime)' },
  { bg: 'var(--brutal-yellow)' },
  { bg: 'var(--brutal-red)', color: '#fff' },
  { bg: 'var(--brutal-blue)', color: '#fff' },
];

export function BrutalistDashboard({ data }: { data: DashboardData }) {
  const { data: achievement, isDemo: achievementIsDemo } = useAchievements();
  const navigate = useNavigate();
  const [txOpen, setTxOpen] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () => scraperApi.syncAll(),
    onSuccess: () => toast.success('סנכרון התחיל'),
    onError: () => toast.error('סנכרון נכשל'),
  });

  const spendableInt = Math.round(data.spendable);
  const timePassedPct =
    data.cycleProgress.daysInCycle > 0
      ? Math.round((data.cycleProgress.dayInCycle / data.cycleProgress.daysInCycle) * 100)
      : 0;

  return (
    <div className="min-h-full bg-[var(--brutal-bg)] text-[var(--brutal-ink)]">
      <div className="brutal-dot-grid pointer-events-none fixed inset-0" aria-hidden />

      <div className="relative flex flex-col gap-3 px-4 pb-4 pt-2">
        <div className="flex items-center justify-end">
          <div
            className="ff-display brutal-border brutal-shadow bg-[var(--brutal-ink)] px-2.5 py-1 text-[11px] font-black tracking-wide text-[var(--brutal-yellow)]"
            aria-label={`מחזור ${data.periodTitle}`}
          >
            {data.periodTitle}
          </div>
        </div>

        <section
          className="brutal-border brutal-shadow relative bg-[var(--brutal-yellow)] px-[18px] py-4 pb-4 pt-[18px]"
          aria-labelledby="brutal-remaining-heading"
        >
          {data.spendable > 0 && data.isCurrentMonth ? (
            <div
              className="ff-display brutal-border absolute -top-2.5 start-3.5 bg-[var(--brutal-pink)] px-2.5 py-1 text-[11px] font-black tracking-wide text-white"
              style={{
                boxShadow: '3px 3px 0 var(--brutal-ink)',
                transform: 'rotate(-6deg)',
              }}
            >
              ★ במסלול ★
            </div>
          ) : null}

          <h2 id="brutal-remaining-heading" className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em]">
            נשאר להוציא
          </h2>
          <p className="ff-display mt-1 tabular-nums text-[64px] leading-[0.9] tracking-[-0.04em]" dir="ltr">
            ₪{spendableInt.toLocaleString('en-US')}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span>
              {data.cycleProgress.daysInCycle - data.cycleProgress.dayInCycle} יום,{' '}
              {data.formatCurrency(data.dailyAllowance)}/יום
            </span>
          </div>
          <div className="brutal-border mt-3.5 bg-[var(--brutal-ink)] p-[3px]">
            <div className="relative h-3 bg-[#222]">
              <div
                className="h-full bg-[var(--brutal-lime)]"
                style={{
                  width: `${data.budgetSpentPct}%`,
                  borderInlineEnd: '2px solid var(--brutal-ink)',
                }}
              />
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-extrabold">
            <span>{data.budgetSpentPct}% של תקציב הוצא</span>
            <span style={{ color: 'var(--brutal-red)' }}>↑ {timePassedPct}% של הזמן עבר</span>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2" aria-label="פעולות מהירות">
          {[
            {
              l: '+ עסקה',
              bg: 'var(--brutal-lime)',
              color: 'var(--brutal-ink)',
              action: () => setTxOpen(true),
            },
            {
              l: 'סנכרון',
              bg: 'var(--brutal-bg)',
              color: 'var(--brutal-ink)',
              action: () => syncMutation.mutate(),
            },
            {
              l: 'תקציב',
              bg: 'var(--brutal-blue)',
              color: '#fff',
              action: () => navigate('/budgets'),
            },
            {
              l: 'דוח',
              bg: 'var(--brutal-pink)',
              color: '#fff',
              action: () => navigate('/categories'),
            },
          ].map((a) => (
            <button
              key={a.l}
              type="button"
              onClick={a.action}
              aria-label={a.l}
              disabled={a.l === 'סנכרון' && syncMutation.isPending}
              aria-busy={a.l === 'סנכרון' && syncMutation.isPending}
              className="ff-display brutal-border cursor-pointer px-1.5 py-2.5 text-xs font-extrabold tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brutal-ink)]"
              style={{
                background: a.bg,
                color: a.color,
                boxShadow: '3px 3px 0 var(--brutal-ink)',
              }}
            >
              {a.l}
            </button>
          ))}
        </section>

        <section
          className="brutal-border brutal-shadow flex items-center gap-2 bg-[var(--brutal-ink)] px-3.5 py-2.5 text-[var(--brutal-yellow)]"
          aria-label={achievementIsDemo ? 'הישג (דמו)' : 'הישג'}
        >
          <span className="text-lg" aria-hidden>
            🔥
          </span>
          <div className="flex-1">
            <div className="ff-display text-[11px] font-black tracking-wide">{achievement.title}</div>
            <div className="text-[11px] font-bold text-[var(--brutal-bg)]">{achievement.subtitle}</div>
          </div>
          <span
            className="ff-display border-2 border-[var(--brutal-bg)] bg-[var(--brutal-lime)] px-1.5 py-0.5 text-[10px] font-black text-[var(--brutal-ink)]"
          >
            {achievement.xp}
          </span>
        </section>

        <section className="grid grid-cols-2 gap-2" aria-label="קטגוריות במעקב">
          {data.mobileCategoryTiles.length > 0 ? (
            data.mobileCategoryTiles.map((cat, i) => {
              const pal = BRUTAL_PALETTE[i % BRUTAL_PALETTE.length]!;
              return (
                <div
                  key={cat.id}
                  className="brutal-border relative p-2.5"
                  style={{
                    background: pal.bg,
                    color: pal.color ?? 'var(--brutal-ink)',
                    boxShadow: '3px 3px 0 var(--brutal-ink)',
                  }}
                >
                  {cat.over ? (
                    <div className="ff-display absolute -top-2 end-2 border-2 border-[var(--brutal-bg)] bg-[var(--brutal-ink)] px-1.5 py-px text-[9px] font-black text-[var(--brutal-yellow)]">
                      ! חריגה
                    </div>
                  ) : null}
                  <div className="text-[11px] font-extrabold">{cat.name}</div>
                  <div className="ff-display mt-1 tabular-nums text-[22px] leading-none" dir="ltr">
                    ₪{cat.display}
                  </div>
                  <div
                    className="mt-1.5 h-1.5"
                    style={{ background: pal.color ? '#ffffff44' : '#00000022' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(cat.pct, 100)}%`,
                        background: pal.color ?? 'var(--brutal-ink)',
                      }}
                    />
                  </div>
                  <div className="mt-0.5 text-[9px] font-extrabold">{Math.round(cat.pct)}%</div>
                </div>
              );
            })
          ) : (
            <p className="col-span-2 text-xs font-bold">אין קטגוריות עם יעד — הגדר בדף קטגוריות</p>
          )}
        </section>

        <section className="brutal-border brutal-shadow bg-white p-2.5" aria-labelledby="brutal-recent-heading">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 id="brutal-recent-heading" className="ff-display text-sm tracking-tight">
              אחרונות
            </h2>
            <Link
              to="/transactions"
              className="text-[10px] font-extrabold focus-visible:underline"
            >
              הכל →
            </Link>
          </div>
          {(data.recent ?? []).slice(0, 5).map((tx, i, arr) => {
            const amount = data.num(tx.amount);
            const isIncome = amount > 0;
            return (
              <div
                key={tx.id}
                className="flex items-center gap-2 py-1.5"
                style={{
                  borderBottom:
                    i === Math.min(arr.length, 5) - 1 ? 'none' : '1px solid var(--brutal-ink)',
                }}
              >
                <span
                  className="ff-display min-w-[28px] border-[1.5px] border-[var(--brutal-ink)] px-1 py-px text-center text-[9px] font-black"
                  style={{
                    background: isIncome ? 'var(--brutal-lime)' : 'var(--brutal-bg)',
                  }}
                >
                  {tx.category?.icon?.slice(0, 3) ?? 'IL'}
                </span>
                <span className="flex-1 truncate text-xs font-bold">{tx.description}</span>
                <span
                  className={cn('tabular-nums text-xs', isIncome && 'font-black')}
                  dir="ltr"
                >
                  {isIncome ? '+' : '−'}₪{Math.abs(amount).toLocaleString('en-US')}
                </span>
              </div>
            );
          })}
        </section>
      </div>

      <AddTransactionModal open={txOpen} onOpenChange={setTxOpen} />
    </div>
  );
}
