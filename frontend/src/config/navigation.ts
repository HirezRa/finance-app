import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Tags,
  Settings,
} from 'lucide-react';

export interface AppNavItem {
  path: string;
  label: string;
  labelEn?: string;
  icon: LucideIcon;
  /** Center elevated item in mobile bottom bar */
  main?: boolean;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { path: '/dashboard', label: 'לוח בקרה', labelEn: 'Overview', icon: LayoutDashboard, main: true },
  { path: '/transactions', label: 'עסקאות', labelEn: 'Transactions', icon: Receipt },
  { path: '/accounts', label: 'חשבונות', labelEn: 'Accounts', icon: Wallet },
  { path: '/budgets', label: 'תקציבים', labelEn: 'Budgets', icon: PiggyBank },
  { path: '/categories', label: 'קטגוריות', labelEn: 'Categories', icon: Tags },
  { path: '/settings', label: 'הגדרות', labelEn: 'Settings', icon: Settings },
];

/** Mobile bottom bar — mirrors sidebar (subset order optimized for thumb reach) */
export const MOBILE_BOTTOM_NAV: AppNavItem[] = [
  { path: '/settings', label: 'הגדרות', icon: Settings },
  { path: '/categories', label: 'קטגוריות', icon: Tags },
  { path: '/dashboard', label: 'בית', icon: LayoutDashboard, main: true },
  { path: '/accounts', label: 'חשבונות', icon: Wallet },
  { path: '/transactions', label: 'עסקאות', icon: Receipt },
];

/** Bento desktop header — same routes as app shell */
export const BENTO_HEADER_NAV = APP_NAV_ITEMS.filter((i) =>
  ['/dashboard', '/transactions', '/accounts', '/budgets', '/categories'].includes(i.path),
).map((i) => ({
  path: i.path,
  label: i.label,
}));

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  APP_NAV_ITEMS.map((i) => [i.path, i.label]),
);
