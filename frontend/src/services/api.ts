import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const reqUrl = String(error.config?.url ?? '');
    const isPublicAuth =
      reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');
    if (status === 401 && !isPublicAuth) {
      useAuthStore.getState().logout();
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<{ accessToken: string; refreshToken: string }>('/auth/login', data),
  register: (data: { email: string; password: string }) =>
    api.post<{ userId: string; email: string }>('/auth/register', data),
  logout: () => Promise.resolve(),
  get2FAStatus: () => api.get('/auth/2fa/status'),
  setup2FA: () => api.get('/auth/2fa/setup'),
  enable2FA: (data: { secret: string; token: string }) =>
    api.post('/auth/2fa/enable', data),
  disable2FA: (data: { password: string }) =>
    api.post('/auth/2fa/disable', data),
};

function dashboardMonthYearParams(month?: number, year?: number) {
  const params: Record<string, number> = {};
  if (month !== undefined && !Number.isNaN(month)) params.month = month;
  if (year !== undefined && !Number.isNaN(year)) params.year = year;
  return params;
}

export const dashboardApi = {
  getSummary: (month?: number, year?: number) =>
    api.get('/dashboard/summary', { params: dashboardMonthYearParams(month, year) }),
  getWeekly: (month?: number, year?: number) =>
    api.get('/dashboard/weekly', { params: dashboardMonthYearParams(month, year) }),
  getCategories: (month?: number, year?: number) =>
    api.get('/dashboard/categories', { params: dashboardMonthYearParams(month, year) }),
  getRecent: (limit = 10) =>
    api.get('/dashboard/recent', { params: { limit } }),
  getAccounts: () => api.get('/dashboard/accounts'),
};

export const transactionsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    accountId?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    status?: 'all' | 'pending' | 'completed';
    type?: string;
    hasInstallments?: boolean;
    /** שליחה ריקה (`[]`) שולחת `accountTypes=` לריקות מכוונת בשרת */
    accountTypes?: string[];
  }) => {
    const p: Record<string, string | number | boolean> = {};
    if (params?.page !== undefined) p.page = params.page;
    if (params?.limit !== undefined) p.limit = params.limit;
    if (params?.accountId) p.accountId = params.accountId;
    if (params?.categoryId) p.categoryId = params.categoryId;
    if (params?.startDate) p.startDate = params.startDate;
    if (params?.endDate) p.endDate = params.endDate;
    if (params?.search) p.search = params.search;
    if (params?.status) p.status = params.status;
    if (params?.type) p.type = params.type;
    if (params?.hasInstallments) p.hasInstallments = true;
    if (params?.accountTypes !== undefined) {
      p.accountTypes =
        params.accountTypes.length > 0 ? params.accountTypes.join(',') : '';
    }
    return api.get('/transactions', { params: p });
  },
  getInstallmentsSummary: () => api.get('/transactions/installments-summary'),
  getOne: (id: string) => api.get(`/transactions/${id}`),
  create: (data: Record<string, unknown>) => api.post('/transactions', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/transactions/${id}`, data),
  updateNote: (id: string, note: string | null) =>
    api.patch(`/transactions/${id}/note`, { note }),
  setExcludeFromCashFlow: (id: string, exclude: boolean) =>
    api.patch(`/transactions/${id}/exclude`, { exclude }),
  delete: (id: string) => api.delete(`/transactions/${id}`),
  deleteAll: () => {
    console.log('Calling DELETE /transactions/all');
    return api.delete<{ deleted: number }>('/transactions/all');
  },
  bulkUpdateCategory: (transactionIds: string[], categoryId: string) =>
    api.patch('/transactions/bulk/category', { transactionIds, categoryId }),
  recategorizeAll: () => api.post('/transactions/recategorize-all'),
};

export const accountsApi = {
  getAll: () => api.get('/accounts'),
  getOne: (id: string) => api.get(`/accounts/${id}`),
  getSummary: (id: string) => api.get(`/accounts/${id}/summary`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

export const categoriesApi = {
  getAll: () => api.get('/categories'),
  getIncome: () => api.get('/categories/income'),
  getExpenses: () => api.get('/categories/expenses'),
  getWithStats: (month?: number, year?: number) => {
    const params: Record<string, number> = {};
    if (month !== undefined && !Number.isNaN(month)) params.month = month;
    if (year !== undefined && !Number.isNaN(year)) params.year = year;
    return api.get('/categories/with-stats', { params });
  },
  checkDuplicate: (params: { name?: string; nameHe?: string }) =>
    api.get('/categories/check-duplicate', { params }),
  create: (data: Record<string, unknown>) => api.post('/categories', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

type BudgetSaveBody = {
  categories: { categoryId: string; amount: number }[];
};

export const budgetsApi = {
  get: (month?: number, year?: number) => {
    const params: Record<string, number> = {};
    if (month !== undefined) params.month = month;
    if (year !== undefined) params.year = year;
    return api.get('/budgets', { params });
  },
  getHistory: (months = 6) =>
    api.get('/budgets/history', { params: { months } }),
  create: (data: { month: number; year: number } & BudgetSaveBody) =>
    api.post('/budgets', data),
  update: (month: number, year: number, data: BudgetSaveBody) =>
    api.put(`/budgets/${month}/${year}`, data),
  delete: (month: number, year: number) =>
    api.delete(`/budgets/${month}/${year}`),
  copyFromPrevious: (month: number, year: number) =>
    api.post(`/budgets/${month}/${year}/copy-previous`),
  moveCategoryUpDown: (budgetCategoryId: string, direction: 'up' | 'down') =>
    api.patch(`/budgets/categories/${budgetCategoryId}/move`, { direction }),
  reorderCategories: (budgetId: string, orderedIds: string[]) =>
    api.patch(`/budgets/${budgetId}/reorder`, { orderedIds }),
  updateCategorySortOrder: (budgetCategoryId: string, sortOrder: number) =>
    api.patch(`/budgets/categories/${budgetCategoryId}/order`, { sortOrder }),
};

export const alertsApi = {
  getAll: () => api.get('/alerts'),
};

export const scraperApi = {
  getInstitutions: () => api.get('/scraper/institutions'),
  getConfigs: () => api.get('/scraper/configs'),
  createConfig: (data: Record<string, unknown>) =>
    api.post('/scraper/configs', data),
  deleteConfig: (id: string) => api.delete(`/scraper/configs/${id}`),
  sync: (configId: string) => api.post(`/scraper/sync/${configId}`),
  syncAll: () => api.post('/scraper/sync-all'),
  getVersion: () => api.get('/scraper/version'),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: Record<string, unknown>) => api.patch('/settings', data),
  getProfile: () => api.get('/settings/profile'),
  updateProfile: (data: Record<string, unknown>) =>
    api.patch('/settings/profile', data),
  getOllama: () => api.get('/settings/integrations/ollama'),
  updateOllama: (data: Record<string, unknown>) =>
    api.patch('/settings/integrations/ollama', data),
  testOllama: (data: { url: string; model?: string }) =>
    api.post('/settings/integrations/ollama/test', data),
  getN8n: () => api.get('/settings/integrations/n8n'),
  updateN8n: (data: Record<string, unknown>) =>
    api.patch('/settings/integrations/n8n', data),
  testN8n: (data: { url: string; secret?: string }) =>
    api.post('/settings/integrations/n8n/test', data),
};
