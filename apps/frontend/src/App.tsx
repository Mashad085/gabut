import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';

import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/layouts/AppLayout';
import AuthLayout from '@/layouts/AuthLayout';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import BudgetPage from '@/pages/BudgetPage';
import AccountsPage from '@/pages/AccountsPage';
import TransactionsPage from '@/pages/TransactionsPage';
import ReportsPage from '@/pages/ReportsPage';
import CommunitiesPage from '@/pages/CommunitiesPage';
import CommunityDetailPage from '@/pages/CommunityDetailPage';
import SchedulesPage from '@/pages/SchedulesPage';
import SettingsPage from '@/pages/SettingsPage';
import NotificationsPage from '@/pages/NotificationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route path="/auth" element={<GuestRoute><AuthLayout /></GuestRoute>}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* App routes */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="budget" element={<BudgetPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="communities" element={<CommunitiesPage />} />
            <Route path="communities/:id" element={<CommunityDetailPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="investment" element={<ReportsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#0f172a' } },
            error: { iconTheme: { primary: '#f43f5e', secondary: '#0f172a' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
