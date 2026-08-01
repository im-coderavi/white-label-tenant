import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterCustomerPage from './pages/RegisterCustomerPage';
import RegisterResellerPage from './pages/RegisterResellerPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import AdminHomePage from './pages/AdminHomePage';
import ResellerHomePage from './pages/ResellerHomePage';
import CustomerHomePage from './pages/CustomerHomePage';
import { ProtectedRoute } from './auth/ProtectedRoute';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCustomerPage />} />
      <Route path="/register-reseller" element={<RegisterResellerPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['master_admin']}>
            <AdminHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin', 'reseller_staff']}>
            <ResellerHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerHomePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
