/** Mock insights — swap hooks to API when endpoints exist */

export const MOCK_AI_INSIGHT = {
  text: 'ההוצאה על מסעדות עומדת כבר על 128% מהתקציב, אך עדיין רק יום 3 — שווה לדלל את 3 השבועות הבאים.',
  primaryAction: 'הצמד תקציב חדש',
  secondaryAction: 'התעלם',
} as const;

export const MOCK_STREAK = {
  months: 3,
  label: '3 חודשים',
  subtitle: '3 חודשים מעל יעד חיסכון',
  monthChips: ['פבר׳', 'מרץ', 'אפר׳', 'מאי'] as const,
  activeMonths: 3,
} as const;

export const MOCK_ACHIEVEMENT = {
  title: 'ACHIEVEMENT UNLOCKED',
  subtitle: '3 חודשים רצף',
  xp: '+50 XP',
} as const;
