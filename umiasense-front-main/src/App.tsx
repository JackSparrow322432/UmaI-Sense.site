import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { authApi } from './api';
import type { User } from './types';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OtpPage from './pages/auth/OtpPage';
import ProfileSetupPage from './pages/auth/ProfileSetupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// App pages
import HomePage from './pages/home/HomePage';
import ChildrenPage from './pages/children/ChildrenPage';
import ChildDetailPage from './pages/children/ChildDetailPage';
import ChildFormPage from './pages/children/ChildFormPage';
import EmotionsPage from './pages/emotions/EmotionsPage';
import ActivitiesPage from './pages/activities/ActivitiesPage';
import DiaryPage from './pages/diary/DiaryPage';
import MilestonesPage from './pages/milestones/MilestonesPage';
import RecommendationsPage from './pages/recommendations/RecommendationsPage';
import ChildProfilePage from './pages/children/ChildProfilePage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import SettingsPage from './pages/settings/SettingsPage';

import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './components/layout/AdminLayout';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage';
import AdminChildDetailPage from './pages/admin/AdminChildDetailPage';
import AdminArticlesPage from './pages/admin/AdminArticlesPage';
import AdminArticleFormPage from './pages/admin/AdminArticleFormPage';
import ArticlesPage from './pages/articles/ArticlesPage';
import ArticleDetailPage from './pages/articles/ArticleDetailPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const HomeRedirect = ({ user }: { user: User | null }) => {
  if (user?.role === 'admin')  return <Navigate to="/admin/users" replace />;
  if (user?.role === 'parent') return <Navigate to="/home" replace />;
  return <Navigate to="/children" replace />;
};

export default function App() {
  const { token, user, setUser, clearAuth } = useAuthStore();
  const [booting, setBooting] = useState(true);

  // On mount: verify token with server and load user
  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    authApi.getMe()
      .then(({ data }) => setUser(data))
      .catch(() => clearAuth())
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/otp" element={<OtpPage />} />
        <Route path="/setup" element={<ProfileSetupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<HomeRedirect user={user} />} />
          <Route path="home" element={<HomePage />} />
          <Route path="children" element={<ChildrenPage />} />
          <Route path="children/new" element={<ChildFormPage />} />
          <Route path="children/:id" element={<ChildDetailPage />} />
          <Route path="children/:id/profile" element={<ChildProfilePage />} />
          <Route path="children/:id/emotions" element={<EmotionsPage />} />
          <Route path="children/:id/activities" element={<ActivitiesPage />} />
          <Route path="children/:id/diary" element={<DiaryPage />} />
          <Route path="children/:id/milestones" element={<MilestonesPage />} />
          <Route path="children/:id/recommendations" element={<RecommendationsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles/:id" element={<ArticleDetailPage />} />
        </Route>

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="children/:childId" element={<AdminChildDetailPage />} />
          <Route path="articles" element={<AdminArticlesPage />} />
          <Route path="articles/new" element={<AdminArticleFormPage />} />
          <Route path="articles/:id/edit" element={<AdminArticleFormPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
