import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CmdKPalette } from '@/components/dashboard/CmdKPalette';
import { AddTransactionModal } from '@/components/dashboard/AddTransactionModal';
import { useInsights, useStreak } from '@/hooks/useInsights';
import { BENTO_HEADER_NAV } from '@/config/navigation';
import type { DashboardData } from '@/components/dashboard/hooks/useDashboardData';
import { getAccountDisplayName } from '@/lib/accountDisplay';
import { formatShortDate } from '@/lib/utils';
import { scraperApi } from '@/services/api';
import {
  Sparkline,
  DonutChart,
  GaugeHalf,
  WeeklyBarChart,
  DayTimeline,
} from './BentoViz';

const PERIOD_TABS = ['יום', 'שבוע', 'מחזור', 'שנה', 'הכל'] as const;

function Tile({
  span,
  className = '',
  paddingZero,
  style,
  ariaLabel,
  children,
}: {
  span: number;
  className?: string;
  paddingZero?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bento-tile ${paddingZero ? 'bento-tile--pad-0' : ''} ${className}`}
      style={{ gridColumn: `span ${span}`, ...style }}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

function formatTxAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}₪${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BentoDashboard({ data }: { data: DashboardData }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const { data: insight } = useInsights();
  const { data: streak, isDemo: streakIsDemo } = useStreak();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);

  const syncMutation = useMutation({
    mutationFn: () => scraperApi.syncAll(),
    onSuccess: () => toast.success('סנכרון התחיל — עקוב בהתקדמות בחשבונות'),
    onError: () => toast.error('הפעלת סנכרון נכשלה'),
  });

  const userName = user?.name ?? user?.email ?? 'משתמש';
  const spendableParts = data.spendableFormatted.replace('₪', '').split('.');
  const abroad = data.summary?.abroad;
  const installments = data.installments;

  return (
    <div className="bento-shell scrollbar-thin">
      <header className="mb-[22px] flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-sm font-bold text-white"
            style={{ background: 'var(--accent-gradient)' }}
          >
            ₪
          </div>
          <span className="text-sm font-semibold">Pingo</span>
          <span className="text-xs text-[var(--dim)]">/</span>
          <span className="text-[13px] text-[var(--dim)]">{userName}</span>
        </div>

        <nav className="ms-4 flex gap-1" aria-label="ניווט ראשי">
          {BENTO_HEADER_NAV.map((n) => {
            const active =
              location.pathname === n.path || location.pathname.startsWith(`${n.path}/`);
            return (
              <NavLink
                key={n.path}
                to={n.path}
                aria-current={active ? 'page' : undefined}
                className={active ? 'bento-nav-btn bento-nav-btn--active' : 'bento-nav-btn !cursor-pointer !opacity-100'}
              >
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2.5">
          <button
            type="button"
            className="flex w-60 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs text-[var(--dim)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            onClick={() => setCmdOpen(true)}
            aria-label="חיפוש מהיר"
          >
            <span aria-hidden>⌕</span>
            <span>חפש עסקה, מסחר, סכום…</span>
            <span className="ms-auto text-[11px] text-[var(--dimmer)]">⌘K</span>
          </button>
          <button
            type="button"
            className="bento-btn-ghost"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            aria-busy={syncMutation.isPending}
          >
            {syncMutation.isPending ? 'מסנכרן…' : 'סנכרון'}
          </button>
          <button
            type="button"
            className="bento-btn-primary"
            onClick={() => setTxOpen(true)}
            aria-label="הוספת עסקה"
          >
            + עסקה
          </button>
          <ThemeToggle className="h-7 w-7 text-[var(--fg)]" />
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3.5">
        <h1 className="text-[22px] font-semibold tracking-tight">סקירה</h1>
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0.5" role="tablist" aria-label="טווח זמן">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === 'מחזור'}
              className={
                tab === 'מחזור'
                  ? 'bento-period-tab bento-period-tab--active'
                  : 'bento-period-tab opacity-60'
              }
              disabled={tab !== 'מחזור'}
              aria-disabled={tab !== 'מחזור'}
              title={tab !== 'מחזור' ? 'בקרוב' : undefined}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2 text-xs text-[var(--dim)]">
          <button
            type="button"
            className="bento-btn-ghost h-6 w-6 p-0 text-sm"
            onClick={() => data.changeMonth(-1)}
            aria-label="מחזור קודם"
          >
            ›
          </button>
          <span>{data.periodTitle}</span>
          <span className="text-[var(--dimmer)]">·</span>
          <span>{data.cycleProgress.label}</span>
          {!data.isCurrentMonth ? (
            <button type="button" className="bento-btn-ghost px-2 py-0.5 text-[11px]" onClick={data.goToCurrentMonth}>
              מחזור נוכחי
            </button>
          ) : null}
          <button
            type="button"
            className="bento-btn-ghost h-6 w-6 p-0 text-sm"
            onClick={() => data.changeMonth(1)}
            aria-label="מחזור הבא"
          >
            ‹
          </button>
        </div>
      </div>

      {data.showFallback ? (
        <p className="mb-3 text-xs text-[var(--bento-amber)]" role="status">
          מוצגים נתונים ממחזור אחרון עם פעילות (אין נתונים במחזור שנבחר).
        </p>
      ) : null}

      <div className="bento-grid">
        <Tile span={3} className="bento-tile--accent-green">
          <div className="bento-label">נשאר להוציא</div>
          <div className="bento-amount-xl mt-2 tabular-nums" dir="ltr">
            ₪{spendableParts[0]}
            {spendableParts[1] ? (
              <span className="text-lg text-[var(--dim)]">.{spendableParts[1]}</span>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                color: data.spendable >= 0 ? 'var(--bento-green)' : 'var(--bento-red)',
                background: `color-mix(in srgb, ${data.spendable >= 0 ? 'var(--bento-green)' : 'var(--bento-red)'} 15%, transparent)`,
              }}
            >
              {data.spendable >= 0 ? '↑ במסלול' : 'חריגה'}
            </span>
            <span className="text-[11px] text-[var(--dim)]">
              {data.cycleProgress.daysInCycle - data.cycleProgress.dayInCycle} יום, ≈
              {data.formatCurrency(data.dailyAllowance)}/יום
            </span>
          </div>
          <DayTimeline
            elapsed={data.cycleProgress.dayInCycle}
            start={String(data.cycleStartDay).padStart(2, '0')}
            end={data.periodTitle.slice(-5)}
          />
        </Tile>

        <Tile span={2}>
          <div className="bento-label">הכנסות</div>
          <div className="bento-amount-lg mt-2 tabular-nums" dir="ltr">
            ₪{data.incomeTotal.toLocaleString('en-US')}
          </div>
          <Sparkline stroke="var(--bento-green)" points="0,20 16,18 33,16 50,14 66,15 83,12 100,10" />
        </Tile>

        <Tile span={2}>
          <div className="bento-label">הוצאות</div>
          <div className="bento-amount-lg mt-2 tabular-nums" dir="ltr">
            ₪{data.expensesTotal.toLocaleString('en-US')}
          </div>
          <Sparkline stroke="var(--bento-red)" points="0,8 16,12 33,10 50,16 66,14 83,18 100,22" />
        </Tile>

        <Tile span={3}>
          <div className="flex items-start justify-between">
            <div>
              <div className="bento-label">חיסכון השנה</div>
              <div className="bento-amount-lg mt-2 tabular-nums" dir="ltr">
                ₪{Math.round(data.savingsYtd).toLocaleString('en-US')}
                {data.savingsGoalAnnual > 0 ? (
                  <span className="text-sm text-[var(--dim)]">
                    {' '}
                    / ₪{data.savingsGoalAnnual.toLocaleString('en-US')}
                  </span>
                ) : null}
              </div>
            </div>
            {data.savingsGoalAnnual > 0 ? (
              <div className="relative h-14 w-14">
                <svg viewBox="0 0 56 56" className="h-full w-full" aria-hidden>
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="var(--bento-purple)"
                    strokeWidth="4"
                    strokeDasharray={`${(data.savingsPct / 100) * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                    transform="rotate(-90 28 28)"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">
                  {data.savingsPct}%
                </div>
              </div>
            ) : null}
          </div>
        </Tile>

        <Tile
          span={2}
          className="bento-tile--accent-purple"
          style={{ background: 'linear-gradient(135deg, var(--panel), #1a0f24)' }}
          ariaLabel={streakIsDemo ? 'רצף (דמו)' : 'רצף'}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base" aria-hidden>
              🔥
            </span>
            <div className="bento-label" style={{ color: 'var(--bento-purple)' }}>
              רצף
            </div>
          </div>
          <div className="mt-1.5 text-[28px] font-semibold">{streak.label}</div>
          <div className="mt-1 text-[11px] text-[var(--dim)]">{streak.subtitle}</div>
        </Tile>

        <Tile span={6}>
          <div>
            <div className="bento-label">הוצאות שבועיות</div>
            <div className="mt-1.5 text-lg font-semibold">
              ₪{data.weeklyTotals.reduce((a, b) => a + b, 0).toLocaleString('en-US')}{' '}
              <span className="text-[13px] font-normal text-[var(--dim)]">
                · {data.weeklyTotals.length} שבועות
              </span>
            </div>
          </div>
          <WeeklyBarChart values={data.weeklyTotals} maxValue={data.weeklyMax} />
        </Tile>

        <Tile span={3}>
          <div className="bento-label">הוצאות לפי קטגוריה</div>
          {data.topCategories.length > 0 ? (
            <div className="mt-3 flex items-center gap-3.5">
              <DonutChart
                values={data.topCategories.map((c) => c.total)}
                sliceColors={data.topCategories.map((c) => c.color || '#64748b')}
              />
              <div className="min-w-0 flex-1 text-[11px]">
                {data.topCategories.map((c) => (
                  <div key={c.categoryId ?? c.nameHe} className="flex items-center gap-1.5 py-0.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: c.color || '#64748b' }}
                    />
                    <span className="flex-1 text-[var(--dim)]">{c.nameHe}</span>
                    <span className="tabular-nums text-[var(--fg)]" dir="ltr">
                      ₪{c.total.toLocaleString('en-US')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--dim)]">אין נתוני קטגוריות למחזור</p>
          )}
        </Tile>

        <Tile span={3}>
          <div className="bento-label">קצב יומי</div>
          <div className="mt-3 flex items-center gap-4">
            <GaugeHalf
              spent={data.dailySpentApprox}
              allowance={data.dailyAllowance}
              pct={data.dailyPacePct}
            />
            <div className="text-[11px] text-[var(--dim)]">
              <div className="text-sm font-semibold text-[var(--fg)]">{data.dailyPacePct}%</div>
              <div>מהמותר היומי</div>
              <span
                className="mt-1.5 inline-block rounded px-1.5 py-1 text-[10px] font-medium"
                style={{
                  color: data.dailyPacePct < 80 ? 'var(--bento-green)' : 'var(--bento-amber)',
                  background: 'color-mix(in srgb, var(--bento-green) 15%, transparent)',
                }}
              >
                {data.dailyPacePct < 80 ? 'הרבה מתחת לקצב' : 'קרוב לקצב'}
              </span>
            </div>
          </div>
        </Tile>

        <Tile span={7} paddingZero>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-3.5">
            <div>
              <div className="bento-label">עסקאות אחרונות</div>
              <div className="mt-0.5 text-[13px]">
                {(data.recent?.length ?? 0)} מתוך {data.summary?.transactionCount ?? 0} במחזור
              </div>
            </div>
            <div className="flex gap-1.5">
              <Link to="/transactions" className="bento-btn-ghost px-2 py-0.5 text-[11px]">
                סינון
              </Link>
              <Link to="/transactions" className="bento-btn-ghost px-2 py-0.5 text-[11px]">
                הכל
              </Link>
            </div>
          </div>
          {(data.recent ?? []).slice(0, 7).map((tx, i, arr) => {
            const amount = data.num(tx.amount);
            const isIncome = amount > 0;
            return (
              <div
                key={tx.id}
                className="grid items-center gap-3 px-[18px] py-2 text-xs"
                style={{
                  gridTemplateColumns: '52px 1fr 80px 80px 110px',
                  borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span className="tabular-nums text-[11px] text-[var(--dim)]">
                  {formatShortDate(tx.date).replace(/\//g, '.').slice(0, 5)}
                </span>
                <span className="font-medium">{tx.description}</span>
                <span>
                  <span className="rounded border border-[var(--border)] bg-[var(--panel-hi)] px-1.5 py-0.5 text-[11px] text-[var(--dim)]">
                    {tx.category?.nameHe ?? 'ללא'}
                  </span>
                </span>
                <span className="text-[11px] text-[var(--dim)]">
                  {tx.account
                    ? getAccountDisplayName({
                        institutionName: tx.account.institutionName ?? '',
                        nickname: tx.account.nickname,
                      })
                    : ''}
                </span>
                <span
                  className="tabular-nums text-start font-medium"
                  dir="ltr"
                  style={{ color: isIncome ? 'var(--bento-green)' : 'var(--fg)' }}
                >
                  {formatTxAmount(amount)}
                </span>
              </div>
            );
          })}
        </Tile>

        <Tile span={5} paddingZero>
          <div className="border-b border-[var(--border)] px-[18px] py-3.5">
            <div className="bento-label">חשבונות</div>
            <div className="mt-0.5 text-[13px]">
              סה״כ נטו{' '}
              <span className="tabular-nums" style={{ color: 'var(--bento-green)' }} dir="ltr">
                {data.formatCurrency(data.accounts?.totalBalance ?? 0)}
              </span>
            </div>
          </div>
          {(data.accounts?.accounts ?? []).map((a, i, arr) => {
            const bal = data.num(a.balance);
            const positive = bal >= 0;
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 px-[18px] py-3"
                style={{
                  borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                  style={{
                    background: positive
                      ? 'color-mix(in srgb, var(--bento-green) 15%, transparent)'
                      : 'color-mix(in srgb, var(--bento-amber) 15%, transparent)',
                    color: positive ? 'var(--bento-green)' : 'var(--bento-amber)',
                  }}
                >
                  {(a.institutionName || '?').charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{getAccountDisplayName(a)}</div>
                  <div className="tabular-nums text-[10px] text-[var(--dim)]" dir="ltr">
                    {a.accountNumber}
                  </div>
                </div>
                <div
                  className="min-w-[96px] text-start text-sm font-semibold tabular-nums"
                  dir="ltr"
                  style={{ color: positive ? 'var(--fg)' : 'var(--bento-red)' }}
                >
                  {data.formatCurrency(bal)}
                </div>
              </div>
            );
          })}
        </Tile>

        <Tile
          span={4}
          className="bento-tile--accent-blue"
          style={{ background: 'linear-gradient(135deg, var(--panel), #0a1424)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded text-[11px]" style={{ color: 'var(--bento-blue)' }}>
              ✦
            </span>
            <div className="bento-label" style={{ color: 'var(--bento-blue)' }}>
              תובנת AI (דמו)
            </div>
          </div>
          <p className="mt-3 text-sm font-medium leading-snug">{insight.text}</p>
          <button
            type="button"
            className="mt-3.5 bento-btn-ghost px-2.5 py-1 text-[11px]"
            onClick={() => navigate('/categories')}
          >
            לקטגוריות
          </button>
        </Tile>

        <Tile span={4}>
          <div className="flex items-start justify-between">
            <div>
              <div className="bento-label">הוצאות חו״ל</div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums" dir="ltr">
                {abroad && abroad.transactionCount > 0
                  ? data.formatCurrency(-Math.abs(abroad.totalSpentILS))
                  : '—'}
              </div>
              {abroad && abroad.transactionCount > 0 ? (
                <div className="mt-1 text-[11px] text-[var(--dim)]">
                  {abroad.transactionCount} עסקאות · {abroad.byCurrency.length} מטבעות
                </div>
              ) : null}
            </div>
            <span aria-hidden>🌐</span>
          </div>
          {abroad && abroad.byCurrency.length > 0 ? (
            <div className="mt-3.5 flex flex-col gap-1 text-[11px]">
              {abroad.byCurrency.map((row) => (
                <div key={row.currency} className="flex justify-between gap-2">
                  <span>{row.currency}</span>
                  <span dir="ltr" className="tabular-nums">
                    {data.formatCurrency(row.totalILS)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Tile>

        <Tile span={4}>
          <div className="flex items-start justify-between">
            <div>
              <div className="bento-label">תשלומים פעילים</div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums" dir="ltr">
                {installments && installments.activeCount > 0
                  ? `−${data.formatCurrency(installments.totalMonthly)}`
                  : '—'}
              </div>
              {installments && installments.activeCount > 0 ? (
                <div className="mt-1 text-[11px] text-[var(--dim)]">
                  {installments.activeCount} מסלולים
                </div>
              ) : null}
            </div>
          </div>
          {(installments?.details ?? []).slice(0, 3).map((it) => (
            <div key={it.description} className="mt-2 flex justify-between gap-2 text-[11px]">
              <span className="truncate">{it.description}</span>
              <span dir="ltr" className="tabular-nums shrink-0">
                {data.formatCurrency(-it.monthlyAmount)}
              </span>
            </div>
          ))}
        </Tile>
      </div>

      <footer className="mt-[18px] flex flex-wrap items-center gap-3.5 text-[11px] text-[var(--dim)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--bento-green)]" />
          מחובר
        </span>
        <span>·</span>
        <span>
          {data.accounts?.count ?? 0} חשבונות · {data.summary?.transactionCount ?? 0} עסקאות
        </span>
      </footer>

      <CmdKPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <AddTransactionModal open={txOpen} onOpenChange={setTxOpen} />
    </div>
  );
}
