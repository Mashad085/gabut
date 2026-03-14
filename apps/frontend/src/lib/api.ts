import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
        const { accessToken, refreshToken: newR } = res.data;
        setAuth(user!, accessToken, newR);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch { logout(); window.location.href = '/auth/login'; }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login:    (d: any) => api.post('/auth/login', d).then(r => r.data),
  register: (d: any) => api.post('/auth/register', d).then(r => r.data),
  logout:   (rt: string) => api.post('/auth/logout', { refreshToken: rt }),
  me:       () => api.get('/auth/me').then(r => r.data),
  changePassword: (d: any) => api.post('/auth/change-password', d).then(r => r.data),
};

export const accountsAPI = {
  list:     () => api.get('/accounts').then(r => r.data),
  get:      (id: string) => api.get(`/accounts/${id}`).then(r => r.data),
  create:   (d: any) => api.post('/accounts', d).then(r => r.data),
  update:   (id: string, d: any) => api.put(`/accounts/${id}`, d).then(r => r.data),
  remove:   (id: string) => api.delete(`/accounts/${id}`).then(r => r.data),
  transfer: (d: any) => api.post('/accounts/transfer', d).then(r => r.data),
};

export const transactionsAPI = {
  list:   (p?: any) => api.get('/transactions', { params: p }).then(r => r.data),
  get:    (id: string) => api.get(`/transactions/${id}`).then(r => r.data),
  create: (d: any) => api.post('/transactions', d).then(r => r.data),
  stats:  (p?: any) => api.get('/transactions/stats/summary', { params: p }).then(r => r.data),
};

export const budgetsAPI = {
  list:          () => api.get('/budgets').then(r => r.data),
  get:           (id: string) => api.get(`/budgets/${id}`).then(r => r.data),
  create:        (d: any) => api.post('/budgets', d).then(r => r.data),
  update:        (id: string, d: any) => api.put(`/budgets/${id}`, d).then(r => r.data),
  remove:        (id: string) => api.delete(`/budgets/${id}`).then(r => r.data),
  addCategory:   (id: string, d: any) => api.post(`/budgets/${id}/categories`, d).then(r => r.data),
  updateCategory:(id: string, cid: string, d: any) => api.put(`/budgets/${id}/categories/${cid}`, d).then(r => r.data),
  deleteCategory:(id: string, cid: string) => api.delete(`/budgets/${id}/categories/${cid}`).then(r => r.data),
};

export const communitiesAPI = {
  list:        (p?: any) => api.get('/communities', { params: p }).then(r => r.data),
  my:          () => api.get('/communities/my').then(r => r.data),
  get:         (id: string) => api.get(`/communities/${id}`).then(r => r.data),
  create:      (d: any) => api.post('/communities', d).then(r => r.data),
  update:      (id: string, d: any) => api.put(`/communities/${id}`, d).then(r => r.data),
  remove:      (id: string) => api.delete(`/communities/${id}`).then(r => r.data),
  join:        (id: string) => api.post(`/communities/${id}/join`).then(r => r.data),
  members:     (id: string) => api.get(`/communities/${id}/members`).then(r => r.data),
  addMember:   (id: string, d: any) => api.post(`/communities/${id}/add-member`, d).then(r => r.data),
  removeMember:(id: string, uid: string) => api.delete(`/communities/${id}/members/${uid}`).then(r => r.data),
  updateRole:  (id: string, uid: string, role: string) => api.patch(`/communities/${id}/members/${uid}/role`, { role }).then(r => r.data),
  transactions:(id: string, p?: any) => api.get(`/communities/${id}/transactions`, { params: p }).then(r => r.data),
  contribute:  (id: string, d: any) => api.post(`/communities/${id}/contribute`, d).then(r => r.data),
};

export const schedulesAPI = {
  list:   () => api.get('/schedules').then(r => r.data),
  create: (d: any) => api.post('/schedules', d).then(r => r.data),
  update: (id: string, d: any) => api.put(`/schedules/${id}`, d).then(r => r.data),
  remove: (id: string) => api.delete(`/schedules/${id}`).then(r => r.data),
};

export const walletAPI = {
  me:       () => api.get('/wallet/me').then(r => r.data),
  users:    (q?: string) => api.get('/wallet/users', { params: { q } }).then(r => r.data),
  topup:    (d: any) => api.post('/wallet/topup', d).then(r => r.data),
  transfer: (d: any) => api.post('/wallet/transfer', d).then(r => r.data),
  all:      () => api.get('/wallet/all').then(r => r.data),
};

export const notificationsAPI = {
  list:    (p?: any) => api.get('/notifications', { params: p }).then(r => r.data),
  read:    (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  readAll: () => api.patch('/notifications/read-all').then(r => r.data),
  remove:  (id: string) => api.delete(`/notifications/${id}`).then(r => r.data),
};

export const reportsAPI = {
  dashboard: () => api.get('/reports/dashboard').then(r => r.data),
  monthly:   (p?: any) => api.get('/reports/monthly', { params: p }).then(r => r.data),
};
