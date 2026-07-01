import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './auth/AuthProvider.jsx';
import AdminShell from './layout/AdminShell.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ResourceListPage from './pages/ResourceListPage.jsx';
import ResourceEditPage from './pages/ResourceEditPage.jsx';
import MediaLibraryPage from './pages/MediaLibraryPage.jsx';
import HomePageEditor from './pages/HomePageEditor.jsx';
import PricingPage from './pages/PricingPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/media" element={<MediaLibraryPage />} />
            <Route path="/home" element={<HomePageEditor />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/resources/:type" element={<ResourceListPage />} />
            <Route path="/resources/:type/new" element={<ResourceEditPage mode="new" />} />
            <Route path="/resources/:type/:id" element={<ResourceEditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
