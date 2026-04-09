/** Subset of UserSettings returned by GET /settings (full row from API). */
export interface UserSettings {
  userId: string;
  budgetCycleStartDay: number;
  monthlySavingsGoal: number;
  salaryStartDay: number;
  salaryEndDay: number;
  includePendingInBudget: boolean;
  includePendingInDashboard: boolean;
  excludeCreditCardChargesFromBudget: boolean;
  budgetWarningEnabled: boolean;
  budgetExceededEnabled: boolean;
  largeExpenseThreshold: string | number | null;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  theme: string;
  language: string;
  dateFormat: string;
}
