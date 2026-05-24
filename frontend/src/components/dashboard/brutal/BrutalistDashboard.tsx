import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAchievements } from '@/hooks/useInsights';
import {
  MOCK_PERIOD,
  MOCK_REMAINING,
  MOCK_CATEGORIES_MOBILE,
  MOCK_TRANSACTIONS_MOBILE,
} from '@/mocks/dashboard';
import { AddTransactionModal } from '@/components/dashboard/AddTransactionModal';
import { cn } from '@/lib/utils';

const BRUTAL_COLORS: Record<string, { bg: string; color?: string }> = {
  lime: { bg: 'var(--brutal-lime)' },
  yellow: { bg: 'var(--brutal-yellow)' },
  red: { bg: 'var(--brutal-red)', color: '#fff' },
  blue: { bg: 'var(--brutal-blue)', color: '#fff' },
};

const NAV = [
  { path: '/dashboard', label: 'בית' },
  { path: '/transactions', label: 'עסקאות' },
  { path: null, label: '+', big: true },
  { path: '/budgets', label: 'תקציב' },
  { path: '/settings', label: 'הגדרות' },
] as const;

export function BrutalistDashboard() {
  const { data: achievement } = useAchievements();
  const location = useLocation();
  const [txOpen, setTxOpen] = useState(false);

  return (
    <div className="brutal-shell">
      <div className="brutal-dot-grid" aria-hidden />

      <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3 pt-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="ff-display brutal-border brutal-shadow flex h-9 w-9 items-center justify-center bg-[var(--brutal-ink)] text-xl font-black text-[var(--brutal-yellow)]">
              ₪
            </div>
            <div className="ff-display text-lg leading-none tracking-tight">פיננסי.</div>
          </div>
          <div className="ff-display brutal-border brutal-shadow bg-[var(--brutal-ink)] px-2.5 py-1 text-[11px] font-black tracking-wide text-[var(--brutal-yellow)]">
            {MOCK_PERIOD.rangeShort}
          </div>
        </header>

        <section className="brutal-border brutal-shadow relative bg-[var(--brutal-yellow)] px-[18px] py-4 pb-4 pt-[18px]">
          <div
            className="ff-display brutal-border absolute -top-2.5 start-3.5 bg-[var(--brutal-pink)] px-2.5 py-1 text-[11px] font-black tracking-wide text-white"
            style={{
              boxShadow: '3px 3px 0 var(--brutal-ink)',
              transform: 'rotate(-6deg)',
            }}
          >
            {MOCK_REMAINING.heroSticker}
          </div>
          <div className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em]">
            נשאר להוציא
          </div>
          <div className="ff-display mt-1 tabular-nums text-[64px] leading-[0.9] tracking-[-0.04em]" dir="ltr">
            ₪{MOCK_REMAINING.displayMobile}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="ff-display brutal-border bg-[var(--brutal-lime)] px-2 py-0.5 text-[11px] font-black">
              {MOCK_REMAINING.aboveTarget}
            </span>
            <span className="text-[11px] font-bold">{MOCK_REMAINING.daysLeft}</span>
          </div>
          <div className="brutal-border mt-3.5 bg-[var(--brutal-ink)] p-[3px]">
            <div className="relative h-3 bg-[#222]">
              <div
                className="h-full bg-[var(--brutal-lime)]"
                style={{
                  width: `${MOCK_REMAINING.budgetSpentPct}%`,
                  borderInlineEnd: '2px solid var(--brutal-ink)',
                }}
              />
              <div
                className="absolute -top-px bottom-[-1px] w-0.5 bg-[var(--brutal-pink)]"
                style={{ left: `${MOCK_REMAINING.progressMarkerPct}%` }}
              />
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-extrabold">
            <span>{MOCK_REMAINING.budgetSpentPct}% של תקציב הוצא</span>
            <span style={{ color: 'var(--brutal-red)' }}>
              ↑ {MOCK_REMAINING.timePassedPct}% של הזמן עבר
            </span>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2">
          {[
            { l: '+ עסקה', bg: 'var(--brutal-lime)', color: 'var(--brutal-ink)', action: () => setTxOpen(true) },
            { l: 'סנכרון', bg: 'var(--brutal-bg)', color: 'var(--brutal-ink)', action: () => {} },
            { l: 'תקציב', bg: 'var(--brutal-blue)', color: '#fff', action: () => {} },
            { l: 'דוח', bg: 'var(--brutal-pink)', color: '#fff', action: () => {} },
          ].map((a) => (
            <button
              key={a.l}
              type="button"
              onClick={a.action}
              className="ff-display brutal-border cursor-pointer px-1.5 py-2.5 text-xs font-extrabold tracking-wide"
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

        <section className="brutal-border brutal-shadow flex items-center gap-2 bg-[var(--brutal-ink)] px-3.5 py-2.5 text-[var(--brutal-yellow)]">
          <span className="text-lg">🔥</span>
          <div className="flex-1">
            <div className="ff-display text-[11px] font-black tracking-wide">{achievement.title}</div>
            <div className="text-[11px] font-bold text-[var(--brutal-bg)]">{achievement.subtitle}</div>
          </div>
          <span
            className="ff-display border-2 border-[var(--brutal-bg)] bg-[var(--brutal-lime)] px-1.5 py-0.5 text-[10px] font-black"
            style={{ color: 'var(--brutal-ink)' }}
          >
            {achievement.xp}
          </span>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {MOCK_CATEGORIES_MOBILE.map((cat) => {
            const pal = BRUTAL_COLORS[cat.colorKey]!;
            const textOnColor = 'textOnColor' in cat && cat.textOnColor;
            const over = 'over' in cat && cat.over;
            return (
              <div
                key={cat.name}
                className="brutal-border relative p-2.5"
                style={{
                  background: pal.bg,
                  color: textOnColor ? pal.color : 'var(--brutal-ink)',
                  boxShadow: '3px 3px 0 var(--brutal-ink)',
                }}
              >
                {over ? (
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
                  style={{
                    background: textOnColor ? '#ffffff44' : '#00000022',
                  }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(cat.pct, 100)}%`,
                      background: textOnColor ? '#fff' : 'var(--brutal-ink)',
                    }}
                  />
                </div>
                <div className="mt-0.5 text-[9px] font-extrabold">{cat.pct}%</div>
              </div>
            );
          })}
        </section>

        <section className="brutal-border brutal-shadow bg-white p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="ff-display text-sm tracking-tight">אחרונות</span>
            <span className="text-[10px] font-extrabold">הכל →</span>
          </div>
          {MOCK_TRANSACTIONS_MOBILE.map((tx, i) => (
            <div
              key={tx.title}
              className="flex items-center gap-2 py-1.5"
              style={{
                borderBottom:
                  i === MOCK_TRANSACTIONS_MOBILE.length - 1
                    ? 'none'
                    : '1px solid var(--brutal-ink)',
              }}
            >
              <span
                className="ff-display min-w-[28px] border-[1.5px] border-[var(--brutal-ink)] px-1 py-px text-center text-[9px] font-black"
                style={{
                  background: tx.highlight ? 'var(--brutal-lime)' : 'var(--brutal-bg)',
                }}
              >
                {tx.tag}
              </span>
              <span className="flex-1 text-xs font-bold">{tx.title}</span>
              <span
                className={cn('tabular-nums text-xs', tx.highlight && 'font-black')}
                dir="ltr"
              >
                {tx.amount}
              </span>
            </div>
          ))}
        </section>
      </div>

      <nav className="relative flex shrink-0 justify-around border-t-[3px] border-[var(--brutal-ink)] bg-[var(--brutal-ink)] px-1 pb-[22px] pt-2">
        {NAV.map((n) => {
          const active = n.path === location.pathname;
          if ('big' in n && n.big) {
            return (
              <button
                key={n.label}
                type="button"
                onClick={() => setTxOpen(true)}
                className="ff-display relative -mt-4 flex h-11 w-11 items-center justify-center border-2 border-[var(--brutal-yellow)] bg-[var(--brutal-lime)] text-2xl font-black text-[var(--brutal-ink)]"
                style={{ boxShadow: '3px 3px 0 var(--brutal-yellow)' }}
              >
                +
              </button>
            );
          }
          const inner = (
            <>
              {active ? (
                <div className="absolute -top-1 left-1/2 h-0.5 w-7 -translate-x-1/2 bg-[var(--brutal-yellow)]" />
              ) : null}
              <div
                className="ff-display text-[11px] font-black"
                style={{
                  color: active ? 'var(--brutal-yellow)' : 'var(--brutal-bg)',
                  opacity: active ? 1 : 0.6,
                }}
              >
                {n.label}
              </div>
            </>
          );
          return n.path ? (
            <Link key={n.label} to={n.path} className="relative text-center">
              {inner}
            </Link>
          ) : (
            <div key={n.label} className="relative text-center">
              {inner}
            </div>
          );
        })}
      </nav>

      <AddTransactionModal open={txOpen} onOpenChange={setTxOpen} />
    </div>
  );
}
