/** AI insight / streak / XP tiles — no backend endpoint yet; disable in prod via env */
export const isDashboardDemoInsightsEnabled =
  import.meta.env.VITE_DASHBOARD_DEMO_INSIGHTS !== 'false';
