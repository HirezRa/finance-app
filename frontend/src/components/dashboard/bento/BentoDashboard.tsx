import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CmdKPalette } from '@/components/dashboard/CmdKPalette';
import { AddTransactionModal } from '@/components/dashboard/AddTransactionModal';
import { useInsights, useStreak } from '@/hooks/useInsights';
import {
  MOCK_PERIOD,
  MOCK_REMAINING,
  MOCK_SUMMARY,
  MOCK_WEEKLY_BARS,
  MOCK_CATEGORIES_BENTO,
  MOCK_DAILY_PACE,
  MOCK_TRANSACTIONS,
  MOCK_ACCOUNTS,
  MOCK_ABROAD,
  MOCK_INSTALLMENTS,
  MOCK_FOOTER,
  MOCK_RECENT_META,
} from '@/mocks/dashboard';
import {
  Sparkline,
  DonutChart,
  GaugeHalf,
  WeeklyBarChart,
  DayTimeline,
  bentoColor,
} from './BentoViz';

const NAV_ITEMS = [
  { label: 'Overview', active: true },
  { label: 'Transactions', active: false },
  { label: 'Accounts', active: false },
  { label: 'Budgets', active: false },
  { label: 'Categories', active: false },
  { label: 'Reports', active: false },
] as const;

const PERIOD_TABS = ['יום', 'שבוע', 'מחזור', 'שנה', 'הכל'] as const;

function Tile({
  span,
  className = '',
  paddingZero,
  style,
  children,
}: {
  span: number;
  className?: string;
  paddingZero?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bento-tile ${paddingZero ? 'bento-tile--pad-0' : ''} ${className}`}
      style={{ gridColumn: `span ${span}`, ...style }}
    >
      {children}
    </div>
  );
}

export function BentoDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: insight } = useInsights();
  const { data: streak } = useStreak();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [activePeriod] = useState('מחזור');

  const userName = user?.name ?? user?.email ?? 'משתמש';

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
          <span className="text-xs text-[var(--dim)]">/</span>
          <span className="text-[13px]">Dashboard</span>
        </div>

        <nav className="ms-4 flex gap-1">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.label}
              type="button"
              disabled={!n.active}
              className={n.active ? 'bento-nav-btn bento-nav-btn--active' : 'bento-nav-btn'}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2.5">
          <button
            type="button"
            className="flex w-60 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs text-[var(--dim)]"
            onClick={() => setCmdOpen(true)}
          >
            <span>⌕</span>
            <span>חפש עסקה, מסחר, סכום…</span>
            <span className="ms-auto text-[11px] text-[var(--dimmer)]">⌘K</span>
          </button>
          <button type="button" className="bento-btn-ghost">
            סנכרון
          </button>
          <button type="button" className="bento-btn-primary" onClick={() => setTxOpen(true)}>
            + עסקה
          </button>
          <ThemeToggle className="h-7 w-7 text-[var(--fg)]" />
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-hi)] text-[11px]">
            {userName.charAt(0)}
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3.5">
        <h1 className="text-[22px] font-semibold tracking-tight">סקירה</h1>
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0.5">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={
                tab === activePeriod
                  ? 'bento-period-tab bento-period-tab--active'
                  : 'bento-period-tab'
              }
              onClick={() => {
                if (tab !== 'מחזור') {
                  /* UI only — phase 1 */
                }
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2 text-xs text-[var(--dim)]">
          <button type="button" className="bento-btn-ghost h-6 w-6 p-0 text-sm">
            ›
          </button>
          <span>{MOCK_PERIOD.rangeLabel}</span>
          <span className="text-[var(--dimmer)]">·</span>
          <span>{MOCK_PERIOD.dayInCycle}</span>
          <button type="button" className="bento-btn-ghost h-6 w-6 p-0 text-sm">
            ‹
          </button>
        </div>
      </div>

      <div className="bento-grid">
        <Tile span={3} className="bento-tile--accent-green">
          <div className="bento-label">נשאר להוציא</div>
          <div className="bento-amount-xl mt-2 tabular-nums" dir="ltr">
            ₪{MOCK_REMAINING.whole}
            <span className="text-lg text-[var(--dim)]">{MOCK_REMAINING.cents}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{ color: 'var(--bento-green)', background: 'color-mix(in srgb, var(--bento-green) 15%, transparent)' }}
            >
              {MOCK_REMAINING.badge}
            </span>
            <span className="text-[11px] text-[var(--dim)]">{MOCK_REMAINING.daysLeft}</span>
          </div>
          <DayTimeline
            elapsed={MOCK_PERIOD.daysElapsed}
            start={MOCK_PERIOD.timelineStart}
            end={MOCK_PERIOD.timelineEnd}
          />
        </Tile>

        <Tile span={2}>
          <div className="bento-label">הכנסות</div>
          <div className="bento-amount-lg mt-2 tabular-nums" dir="ltr">
            ₪{MOCK_SUMMARY.income.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-[11px] text-[var(--dim)]">{MOCK_SUMMARY.incomeNote}</div>
          <Sparkline stroke="var(--bento-green)" points="0,20 16,18 33,16 50,14 66,15 83,12 100,10" />
        </Tile>

        <Tile span={2}>
          <div className="bento-label">הוצאות</div>
          <div className="bento-amount-lg mt-2 tabular-nums" dir="ltr">
            ₪{MOCK_SUMMARY.expenses.toLocaleString('en-US')}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px]">
            <span style={{ color: 'var(--bento-green)' }}>{MOCK_SUMMARY.expenseChange}</span>
            <span className="text-[var(--dim)]">{MOCK_SUMMARY.expenseChangeRef}</span>
          </div>
          <Sparkline stroke="var(--bento-red)" points="0,8 16,12 33,10 50,16 66,14 83,18 100,22" />
        </Tile>

        <Tile span={3}>
          <div className="flex items-start justify-between">
            <div>
              <div className="bento-label">חיסכון השנה</div>
              <div className="bento-amount-lg mt-2 tabular-nums" dir="ltr">
                ₪{MOCK_SUMMARY.savingsYear.toLocaleString('en-US')}
                <span className="text-sm text-[var(--dim)]"> / ₪120K</span>
              </div>
            </div>
            <div className="relative h-14 w-14">
              <svg viewBox="0 0 56 56" className="h-full w-full">
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="var(--bento-purple)"
                  strokeWidth="4"
                  strokeDasharray={`${0.32 * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                  transform="rotate(-90 28 28)"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">
                {MOCK_SUMMARY.savingsPct}%
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-[var(--dim)]">{MOCK_SUMMARY.savingsNote}</div>
        </Tile>

        <Tile
          span={2}
          className="bento-tile--accent-purple"
          style={{ background: 'linear-gradient(135deg, var(--panel), #1a0f24)' } as React.CSSProperties}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base">🔥</span>
            <div className="bento-label" style={{ color: 'var(--bento-purple)' }}>
              רצף
            </div>
          </div>
          <div className="mt-1.5 text-[28px] font-semibold">{streak.label}</div>
          <div className="mt-1 text-[11px] text-[var(--dim)]">{streak.subtitle}</div>
          <div className="mt-2 flex gap-1">
            {streak.monthChips.map((m, i) => (
              <div
                key={m}
                className="flex-1 rounded py-0.5 text-center text-[9px]"
                style={{
                  background: i < streak.activeMonths ? 'color-mix(in srgb, var(--bento-purple) 40%, transparent)' : 'var(--panel-hi)',
                  color: i < streak.activeMonths ? 'var(--bento-purple)' : 'var(--dim)',
                }}
              >
                {m}
              </div>
            ))}
          </div>
        </Tile>

        <Tile span={6}>
          <div className="flex items-center justify-between">
            <div>
              <div className="bento-label">הוצאות שבועיות</div>
              <div className="mt-1.5 text-lg font-semibold">
                ₪{MOCK_SUMMARY.weeklyTotal.toLocaleString('en-US')}{' '}
                <span className="text-[13px] font-normal text-[var(--dim)]">
                  · {MOCK_SUMMARY.weeklyWeeks} שבועות
                </span>
              </div>
            </div>
          </div>
          <WeeklyBarChart values={MOCK_WEEKLY_BARS} />
        </Tile>

        <Tile span={3}>
          <div className="bento-label">הוצאות לפי קטגוריה</div>
          <div className="mt-3 flex items-center gap-3.5">
            <DonutChart
              values={MOCK_CATEGORIES_BENTO.map((c) => c.value)}
              colorKeys={MOCK_CATEGORIES_BENTO.map((c) => c.colorKey)}
            />
            <div className="min-w-0 flex-1 text-[11px]">
              {MOCK_CATEGORIES_BENTO.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 py-0.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: bentoColor(c.colorKey) }}
                  />
                  <span className="flex-1 text-[var(--dim)]">{c.name}</span>
                  <span className="tabular-nums text-[var(--fg)]" dir="ltr">
                    ₪{c.display}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Tile>

        <Tile span={3}>
          <div className="bento-label">קצב יומי</div>
          <div className="mt-3 flex items-center gap-4">
            <GaugeHalf />
            <div className="text-[11px] text-[var(--dim)]">
              <div className="text-sm font-semibold text-[var(--fg)]">{MOCK_DAILY_PACE.pct}%</div>
              <div>מהמותר היומי</div>
              <span
                className="mt-1.5 inline-block rounded px-1.5 py-1 text-[10px] font-medium"
                style={{ color: 'var(--bento-green)', background: 'color-mix(in srgb, var(--bento-green) 15%, transparent)' }}
              >
                {MOCK_DAILY_PACE.status}
              </span>
            </div>
          </div>
        </Tile>

        <Tile span={7} paddingZero>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-3.5">
            <div>
              <div className="bento-label">עסקאות אחרונות</div>
              <div className="mt-0.5 text-[13px]">{MOCK_RECENT_META}</div>
            </div>
            <div className="flex gap-1.5">
              <button type="button" className="bento-btn-ghost px-2 py-0.5 text-[11px]">
                סינון
              </button>
              <button type="button" className="bento-btn-ghost px-2 py-0.5 text-[11px]">
                יצוא
              </button>
            </div>
          </div>
          {MOCK_TRANSACTIONS.map((tx, i) => (
            <div
              key={i}
              className="grid items-center gap-3 px-[18px] py-2 text-xs"
              style={{
                gridTemplateColumns: '52px 1fr 80px 80px 110px',
                borderBottom: i === MOCK_TRANSACTIONS.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <span className="tabular-nums text-[11px] text-[var(--dim)]">{tx.date}</span>
              <span className="font-medium">{tx.title}</span>
              <span>
                <span className="rounded border border-[var(--border)] bg-[var(--panel-hi)] px-1.5 py-0.5 text-[11px] text-[var(--dim)]">
                  {tx.category}
                </span>
              </span>
              <span className="text-[11px] text-[var(--dim)]">{tx.account}</span>
              <span
                className="tabular-nums text-start font-medium"
                dir="ltr"
                style={{
                  color: tx.positive
                    ? 'var(--bento-green)'
                    : tx.transfer
                      ? 'var(--bento-purple)'
                      : 'var(--fg)',
                }}
              >
                {tx.amount}
              </span>
            </div>
          ))}
        </Tile>

        <Tile span={5} paddingZero>
          <div className="border-b border-[var(--border)] px-[18px] py-3.5">
            <div className="bento-label">חשבונות</div>
            <div className="mt-0.5 text-[13px]">
              סה״כ נטו{' '}
              <span className="tabular-nums" style={{ color: 'var(--bento-green)' }} dir="ltr">
                {MOCK_ACCOUNTS.netTotal}
              </span>
            </div>
          </div>
          {MOCK_ACCOUNTS.items.map((a, i) => (
            <div
              key={a.name}
              className="flex items-center gap-3 px-[18px] py-3"
              style={{
                borderBottom: i === MOCK_ACCOUNTS.items.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                style={{
                  background: a.positive
                    ? 'color-mix(in srgb, var(--bento-green) 15%, transparent)'
                    : 'color-mix(in srgb, var(--bento-amber) 15%, transparent)',
                  color: a.positive ? 'var(--bento-green)' : 'var(--bento-amber)',
                }}
              >
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{a.name}</div>
                <div className="tabular-nums text-[10px] text-[var(--dim)]" dir="ltr">
                  {a.sub}
                </div>
              </div>
              <div className="text-[10px] text-[var(--dim)]">{a.type}</div>
              <div
                className="min-w-[96px] text-start text-sm font-semibold tabular-nums"
                dir="ltr"
                style={{ color: a.positive ? 'var(--fg)' : 'var(--bento-red)' }}
              >
                {a.balance}
              </div>
            </div>
          ))}
        </Tile>

        <Tile
          span={4}
          className="bento-tile--accent-blue"
          style={{ background: 'linear-gradient(135deg, var(--panel), #0a1424)' }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="flex h-[18px] w-[18px] items-center justify-center rounded text-[11px]"
              style={{ background: 'color-mix(in srgb, var(--bento-blue) 25%, transparent)', color: 'var(--bento-blue)' }}
            >
              ✦
            </span>
            <div className="bento-label" style={{ color: 'var(--bento-blue)' }}>
              תובנת AI
            </div>
          </div>
          <p className="mt-3 text-sm font-medium leading-snug">{insight.text}</p>
          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              className="rounded-md px-2.5 py-1 text-[11px] font-medium"
              style={{
                background: 'color-mix(in srgb, var(--bento-blue) 20%, transparent)',
                color: 'var(--bento-blue)',
                border: '1px solid color-mix(in srgb, var(--bento-blue) 40%, transparent)',
              }}
            >
              {insight.primaryAction}
            </button>
            <button type="button" className="bento-btn-ghost px-2.5 py-1 text-[11px]">
              {insight.secondaryAction}
            </button>
          </div>
        </Tile>

        <Tile span={4}>
          <div className="flex items-start justify-between">
            <div>
              <div className="bento-label">הוצאות חו״ל</div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums" dir="ltr">
                {MOCK_ABROAD.total}
              </div>
              <div className="mt-1 text-[11px] text-[var(--dim)]">
                {MOCK_ABROAD.transactions} עסקאות · {MOCK_ABROAD.currencies} מטבעות
              </div>
            </div>
            <span className="text-lg">🌐</span>
          </div>
          <div className="mt-3.5 flex gap-1.5">
            {MOCK_ABROAD.breakdown.map((cur) => (
              <div
                key={cur.code}
                className="rounded-md border border-[var(--border)] bg-[var(--panel-hi)] px-2.5 py-2"
                style={{ flex: cur.pct }}
              >
                <div className="text-[11px] font-semibold">
                  {cur.code} {cur.original}
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--dim)]">{cur.ils}</div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile span={4}>
          <div className="flex items-start justify-between">
            <div>
              <div className="bento-label">תשלומים פעילים</div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums" dir="ltr">
                {MOCK_INSTALLMENTS.monthly}
              </div>
              <div className="mt-1 text-[11px] text-[var(--dim)]">
                {MOCK_INSTALLMENTS.plans} מסלולים · נותר {MOCK_INSTALLMENTS.remaining}
              </div>
            </div>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: 'var(--bento-amber)', background: 'color-mix(in srgb, var(--bento-amber) 15%, transparent)' }}
            >
              {MOCK_INSTALLMENTS.plans}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-[11px]">
            {MOCK_INSTALLMENTS.items.map((it) => (
              <div key={it.name} className="flex items-center justify-between">
                <span>{it.name}</span>
                <span className="text-[10px] text-[var(--dim)]">{it.progress}</span>
                <span className="tabular-nums" dir="ltr">
                  −{it.amount}
                </span>
              </div>
            ))}
          </div>
        </Tile>
      </div>

      <footer className="mt-[18px] flex flex-wrap items-center gap-3.5 text-[11px] text-[var(--dim)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--bento-green)' }} />
          {MOCK_FOOTER.syncStatus}
        </span>
        <span>·</span>
        <span>
          {MOCK_FOOTER.accounts} חשבונות · {MOCK_FOOTER.transactions} עסקאות
        </span>
        <span>·</span>
        <span>{MOCK_FOOTER.nextSync}</span>
        <span className="ms-auto">{MOCK_FOOTER.version}</span>
      </footer>

      <CmdKPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <AddTransactionModal open={txOpen} onOpenChange={setTxOpen} />
    </div>
  );
}
