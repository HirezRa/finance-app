const COLORS = {
  green: 'var(--bento-green)',
  amber: 'var(--bento-amber)',
  red: 'var(--bento-red)',
  blue: 'var(--bento-blue)',
  pink: 'var(--bento-pink)',
  purple: 'var(--bento-purple)',
} as const;

export type BentoColorKey = keyof typeof COLORS;

export function bentoColor(key: BentoColorKey) {
  return COLORS[key];
}

export function Sparkline({ stroke, points }: { stroke: string; points: string }) {
  return (
    <svg viewBox="0 0 100 30" className="mt-1.5 h-6 w-full">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" />
      <polyline
        points={`0,30 ${points} 100,30`}
        fill={stroke}
        fillOpacity="0.1"
        stroke="none"
      />
    </svg>
  );
}

export function DonutChart({
  values,
  colorKeys,
}: {
  values: number[];
  colorKeys: BentoColorKey[];
}) {
  const total = values.reduce((a, c) => a + c, 0);
  let angle = -Math.PI / 2;

  const slices = values.map((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    const x1 = 50 + 40 * Math.cos(angle);
    const y1 = 50 + 40 * Math.sin(angle);
    const x2 = 50 + 40 * Math.cos(angle + slice);
    const y2 = 50 + 40 * Math.sin(angle + slice);
    const ix1 = 50 + 24 * Math.cos(angle + slice);
    const iy1 = 50 + 24 * Math.sin(angle + slice);
    const ix2 = 50 + 24 * Math.cos(angle);
    const iy2 = 50 + 24 * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A 24 24 0 ${large} 0 ${ix2} ${iy2} Z`;
    angle += slice;
    return { d, fill: bentoColor(colorKeys[i]!) };
  });

  return (
    <svg viewBox="0 0 100 100" className="h-[100px] w-[100px] shrink-0">
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} />
      ))}
    </svg>
  );
}

export function GaugeHalf() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-[120px] shrink-0">
      <path
        d="M 12 70 A 48 48 0 0 1 108 70"
        fill="none"
        stroke="var(--border)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M 12 70 A 48 48 0 0 1 108 70"
        fill="none"
        stroke="var(--bento-green)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="80 200"
      />
      <line
        x1="60"
        y1="70"
        x2="44"
        y2="32"
        stroke="var(--fg)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="60" cy="70" r="4" fill="var(--fg)" />
      <text x="60" y="58" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--fg)">
        ₪181
      </text>
      <text x="60" y="74" textAnchor="middle" fontSize="9" fill="var(--dim)">
        של ₪513
      </text>
    </svg>
  );
}

export function WeeklyBarChart({ values }: { values: readonly number[] }) {
  const max = 4500;
  return (
    <svg viewBox="0 0 600 160" className="mt-3.5 h-[170px] w-full">
      <defs>
        <linearGradient id="bentoBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-accent)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--chart-accent)" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const h = (v / max) * 130;
        const x = 30 + i * 115;
        return (
          <g key={i}>
            <rect
              x={x}
              y={140 - h}
              width={80}
              height={h}
              rx="3"
              fill={i === 4 ? 'var(--bento-amber)' : 'url(#bentoBarGrad)'}
              opacity={i === 4 ? 0.55 : 1}
            />
            <text
              x={x + 40}
              y={140 - h - 6}
              textAnchor="middle"
              fontSize="11"
              fill="var(--fg)"
              fontWeight="600"
            >
              ₪{v.toLocaleString('en-US')}
            </text>
            <text x={x + 40} y={156} textAnchor="middle" fontSize="11" fill="var(--dim)">
              שבוע {i + 1}
            </text>
          </g>
        );
      })}
      <line x1="0" y1="140" x2="600" y2="140" stroke="var(--border)" strokeWidth="1" />
    </svg>
  );
}

export function DayTimeline({
  elapsed,
  start,
  end,
}: {
  elapsed: number;
  start: string;
  end: string;
}) {
  return (
    <>
      <div className="mt-3 flex gap-0.5">
        {Array.from({ length: 31 }).map((_, i) => (
          <div
            key={i}
            className="h-[22px] flex-1 rounded-sm"
            style={{
              background: i < elapsed ? 'var(--bento-amber)' : 'var(--border-hi)',
              opacity: i < elapsed ? 0.9 : 0.6,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--dim)]">
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </>
  );
}
