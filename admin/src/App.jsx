import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ProtectedRoute } from './auth/AuthProvider.jsx';
import AdminShell from './layout/AdminShell.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ResourceListPage from './pages/ResourceListPage.jsx';
import ResourceEditPage from './pages/ResourceEditPage.jsx';

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
