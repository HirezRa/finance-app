/** Dashboard mock data — 1:1 with variations/bento.jsx & variations/mobile-b.jsx */

export const MOCK_PERIOD = {
  rangeLabel: '10 במאי — 9 ביוני 2026',
  rangeShort: '10.05–09.06',
  dayInCycle: 'יום 3/31',
  timelineStart: '10.05',
  timelineEnd: '09.06',
  daysElapsed: 3,
  daysTotal: 31,
} as const;

export const MOCK_REMAINING = {
  whole: '14,372',
  cents: '.40',
  displayMobile: '14,372',
  badge: '↑ במסלול',
  daysLeft: '28 יום, ≈₪513/יום',
  heroSticker: '★ חודש שיא ★',
  aboveTarget: '+₪4,244 מעל היעד!',
  budgetSpentPct: 49,
  timePassedPct: 10,
  progressMarkerPct: 9.6,
} as const;

export const MOCK_SUMMARY = {
  income: 28_500,
  incomeNote: 'משכורת + ביט',
  expenses: 14_128,
  expenseChange: '↓ 18.4%',
  expenseChangeRef: 'מ-04/26',
  savingsYear: 38_400,
  savingsGoal: 120_000,
  savingsPct: 32,
  savingsNote: 'קצב נוכחי ≈ ₪9,600/חודש · יעד 12/26',
  weeklyTotal: 14_127,
  weeklyWeeks: 5,
} as const;

export const MOCK_WEEKLY_BARS = [2840, 3620, 2495, 3892, 1280] as const;

export const MOCK_CATEGORIES_BENTO = [
  { name: 'סופר', value: 3420, display: '3,420', colorKey: 'green' as const },
  { name: 'חשבונות', value: 2850, display: '2,850', colorKey: 'amber' as const },
  { name: 'מסעדות', value: 1920, display: '1,920', colorKey: 'red' as const },
  { name: 'תחבורה', value: 1640, display: '1,640', colorKey: 'blue' as const },
  { name: 'קניות', value: 1490, display: '1,490', colorKey: 'pink' as const },
  { name: 'בידור', value: 890, display: '890', colorKey: 'purple' as const },
] as const;

export const MOCK_CATEGORIES_MOBILE = [
  { name: 'סופר', display: '3,420', pct: 85, colorKey: 'lime' as const },
  { name: 'חשבונות', display: '2,850', pct: 89, colorKey: 'yellow' as const },
  {
    name: 'מסעדות',
    display: '1,920',
    pct: 128,
    colorKey: 'red' as const,
    over: true,
    textOnColor: true,
  },
  { name: 'תחבורה', display: '1,640', pct: 74, colorKey: 'blue' as const, textOnColor: true },
] as const;

export const MOCK_DAILY_PACE = {
  spent: 181,
  allowed: 513,
  pct: 35,
  status: 'הרבה מתחת לקצב',
} as const;

export const MOCK_TRANSACTIONS = [
  {
    date: '12.05',
    title: 'שופרסל דיל בן יהודה',
    category: 'סופר',
    account: 'הפועלים',
    amount: '−₪284.90',
    positive: false,
    transfer: false,
  },
  {
    date: '12.05',
    title: 'קפה לנדוור — דיזנגוף',
    category: 'מסעדות',
    account: 'מקס איט',
    amount: '−₪68.50',
    positive: false,
    transfer: false,
  },
  {
    date: '11.05',
    title: 'משכורת — ניהול פיננסי בע״מ',
    category: 'משכורת',
    account: 'לאומי',
    amount: '+₪18,500.00',
    positive: true,
    transfer: false,
  },
  {
    date: '11.05',
    title: 'פז תחנת דלק — רמת אביב',
    category: 'תחבורה',
    account: 'ויזה כאל',
    amount: '−₪412.00',
    positive: false,
    transfer: false,
  },
  {
    date: '10.05',
    title: 'IKEA — שולחן עבודה (3/12)',
    category: 'קניות',
    account: 'ויזה כאל',
    amount: '−₪749.00',
    positive: false,
    transfer: false,
  },
  {
    date: '10.05',
    title: 'נטפליקס מנוי חודשי',
    category: 'בידור',
    account: 'מקס איט',
    amount: '−₪54.90',
    positive: false,
    transfer: false,
  },
  {
    date: '09.05',
    title: 'העברה לקופת גמל',
    category: 'העברה',
    account: 'לאומי',
    amount: '−₪2,000.00',
    positive: false,
    transfer: true,
  },
] as const;

export const MOCK_TRANSACTIONS_MOBILE = [
  { title: 'שופרסל', amount: '−₪284.90', tag: 'IL', highlight: false },
  { title: 'משכורת', amount: '+₪18,500', tag: '$$', highlight: true },
  { title: 'פז דלק', amount: '−₪412', tag: 'CAR', highlight: false },
] as const;

export const MOCK_ACCOUNTS = {
  netTotal: '₪18,346.55',
  items: [
    {
      name: 'לאומי — פרטי',
      sub: '12-345-678901',
      type: 'עו״ש',
      balance: '₪22,148.55',
      positive: true,
      icon: 'L',
    },
    {
      name: 'הפועלים — עו״ש',
      sub: '11-024-559820',
      type: 'עו״ש',
      balance: '₪4,902.10',
      positive: true,
      icon: 'H',
    },
    {
      name: 'ויזה כאל',
      sub: '**** 4012',
      type: 'אשראי',
      balance: '−₪6,284.30',
      positive: false,
      icon: 'V',
    },
    {
      name: 'מקס איט',
      sub: '**** 8821',
      type: 'אשראי',
      balance: '−₪2,419.80',
      positive: false,
      icon: 'M',
    },
  ],
} as const;

export const MOCK_ABROAD = {
  total: '−₪1,842.30',
  transactions: 11,
  currencies: 3,
  breakdown: [
    { code: 'USD', original: '312', ils: '₪1,149', pct: 62 },
    { code: 'EUR', original: '142', ils: '₪564', pct: 31 },
    { code: 'GBP', original: '25', ils: '₪130', pct: 7 },
  ],
} as const;

export const MOCK_INSTALLMENTS = {
  monthly: '−₪2,184/חודש',
  plans: 5,
  remaining: '₪9,628',
  items: [
    { name: 'IKEA רהיטים', progress: '3/12', amount: '₪749' },
    { name: 'Apple iPhone', progress: '7/36', amount: '₪165' },
    { name: 'אלקטרה תיקון', progress: '2/6', amount: '₪420' },
  ],
} as const;

export const MOCK_FOOTER = {
  syncStatus: 'מסונכרן · 09:42',
  accounts: 4,
  transactions: 147,
  nextSync: 'סנכרון הבא ב-11:42',
  version: 'Pingo v2.4.1 · MIT',
} as const;

export const MOCK_RECENT_META = '7 מתוך 147 במחזור';
