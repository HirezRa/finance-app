import {
  MOCK_AI_INSIGHT,
  MOCK_STREAK,
  MOCK_ACHIEVEMENT,
} from '@/mocks/insights';

/** Replace with API fetch when endpoint exists */
export function useInsights() {
  return { data: MOCK_AI_INSIGHT, isLoading: false };
}

export function useStreak() {
  return { data: MOCK_STREAK, isLoading: false };
}

export function useAchievements() {
  return { data: MOCK_ACHIEVEMENT, isLoading: false };
}
