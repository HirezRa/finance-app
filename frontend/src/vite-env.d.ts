/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Set to "false" to hide demo AI/streak/XP tiles on dashboard */
  readonly VITE_DASHBOARD_DEMO_INSIGHTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
