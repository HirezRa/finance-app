import {
  MOCK_AI_INSIGHT,
  MOCK_STREAK,
  MOCK_ACHIEVEMENT,
} from '@/mocks/insights';
import { isDashboardDemoInsightsEnabled } from '@/config/featureFlags';

const EMPTY_INSIGHT = { text: 'אין תובנה זמינה', badge: '' };
const EMPTY_STREAK = { label: '—', subtitle: '' };
const EMPTY_ACHIEVEMENT = { title: '—', subtitle: '', xp: '' };

/** Demo-only until insights API exists; set VITE_DASHBOARD_DEMO_INSIGHTS=false to hide mocks */
export function useInsights() {
  const enabled = isDashboardDemoInsightsEnabled;
  return { data: enabled ? MOCK_AI_INSIGHT : EMPTY_INSIGHT, isLoading: false, isDemo: enabled };
}

export function useStreak() {
  const enabled = isDashboardDemoInsightsEnabled;
  return { data: enabled ? MOCK_STREAK : EMPTY_STREAK, isLoading: false, isDemo: enabled };
}

export function useAchievements() {
  const enabled = isDashboardDemoInsightsEnabled;
  return {
    data: enabled ? MOCK_ACHIEVEMENT : EMPTY_ACHIEVEMENT,
    isLoading: false,
    isDemo: enabled,
  };
}
