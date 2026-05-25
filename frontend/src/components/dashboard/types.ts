export interface CashFlowSummary {
  month: number;
  year: number;
  usedFallbackToLatestMonth?: boolean;
  usedFallback?: boolean;
  income: { total: number; fixed: number; variable: number };
  expenses: {
    total: number;
    fixed: number;
    tracked: number;
    variable: number;
  };
  remaining: number;
  balance?: number;
  availableBalance?: number;
  monthlySavingsGoal?: number;
  budgetCycleStartDay?: number;
  transactionCount: number;
  abroad?: {
    totalSpentILS: number;
    transactionCount: number;
    byCurrency: Array<{
      currency: string;
      totalILS: number;
      totalOriginal: number;
      count: number;
    }>;
  };
}

export interface WeeklyRow {
  week: number;
  startDate: string;
  endDate: string;
  total: number;
}

export interface CategoryBreakdownRow {
  categoryId: string | null;
  name: string;
  nameHe: string;
  icon: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

export interface RecentTxn {
  id: string;
  date: string;
  amount: string | number;
  description: string;
  categoryId?: string | null;
  account?: {
    institutionName?: string;
    nickname?: string | null;
    description?: string | null;
  };
  category?: {
    id?: string | null;
    name?: string;
    nameHe?: string;
    icon?: string;
    color?: string;
  };
  isUncategorized?: boolean;
}

export interface AccountsOverview {
  accounts: Array<{
    id: string;
    institutionName: string;
    accountNumber: string;
    balance: string | number | null;
    nickname?: string | null;
    description?: string | null;
  }>;
  totalBalance: number;
  count: number;
}

export interface InstallmentsSummary {
  activeCount: number;
  totalMonthly: number;
  totalRemaining: number;
  details: Array<{
    description: string;
    monthlyAmount: number;
    currentPayment: number | null;
    totalPayments: number | null;
    remainingPayments: number;
    totalPaid: number;
    remainingAmount: number;
  }>;
}
