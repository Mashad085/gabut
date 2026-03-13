import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setAuth, logout, user } = useAuthStore.getState();
      if (!refreshToken) { logout(); return Promise.reject(error); }
      try {
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = res.data;
        setAuth(user!, accessToken, newRefresh);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        logout();
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Typed helpers
export const authAPI = {
  login: (data: { email: string; password: string; totp_code?: string }) =>
    api.post('/auth/login', data).then(r => r.data),
  register: (data: any) => api.post('/auth/register', data).then(r => r.data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me').then(r => r.data),
  setup2fa: () => api.post('/auth/2fa/setup').then(r => r.data),
  verify2fa: (totp_code: string) => api.post('/auth/2fa/verify', { totp_code }).then(r => r.data),
  changePassword: (data: any) => api.post('/auth/change-password', data).then(r => r.data),
};

export const accountsAPI = {
  list: () => api.get('/accounts').then(r => r.data),
  get: (id: string) => api.get(`/accounts/${id}`).then(r => r.data),
  create: (data: any) => api.post('/accounts', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/accounts/${id}`, data).then(r => r.data),
};

export const transactionsAPI = {
  list: (params?: any) => api.get('/transactions', { params }).then(r => r.data),
  get: (id: string) => api.get(`/transactions/${id}`).then(r => r.data),
  create: (data: any) => api.post('/transactions', data).then(r => r.data),
  stats: (params?: any) => api.get('/transactions/stats/summary', { params }).then(r => r.data),
};

export const communitiesAPI = {
  list: (params?: any) => api.get('/communities', { params }).then(r => r.data),
  my: () => api.get('/communities/my').then(r => r.data),
  get: (id: string) => api.get(`/communities/${id}`).then(r => r.data),
  create: (data: any) => api.post('/communities', data).then(r => r.data),
  join: (id: string) => api.post(`/communities/${id}/join`).then(r => r.data),
  members: (id: string) => api.get(`/communities/${id}/members`).then(r => r.data),
  transactions: (id: string, params?: any) =>
    api.get(`/communities/${id}/transactions`, { params }).then(r => r.data),
  contribute: (id: string, data: any) =>
    api.post(`/communities/${id}/contribute`, data).then(r => r.data),
};

export const reportsAPI = {
  dashboard: () => api.get('/reports/dashboard').then(r => r.data),
  investment: () => api.get('/reports/investment').then(r => r.data),
  costOfLiving: (params?: any) => api.get('/reports/cost-of-living', { params }).then(r => r.data),
  netWorth: () => api.get('/reports/net-worth').then(r => r.data),
};

export const budgetsAPI = {
  list: () => api.get('/budgets').then(r => r.data),
  get: (id: string) => api.get(`/budgets/${id}`).then(r => r.data),
  create: (data: any) => api.post('/budgets', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/budgets/${id}`, data).then(r => r.data),
};

export const notificationsAPI = {
  list: (params?: any) => api.get('/notifications', { params }).then(r => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then(r => r.data),
};
