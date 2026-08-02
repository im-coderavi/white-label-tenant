import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterCustomerPage from './pages/RegisterCustomerPage';
import RegisterResellerPage from './pages/RegisterResellerPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ProductsListPage from './pages/admin/ProductsListPage';
import ProductFormPage from './pages/admin/ProductFormPage';
import ProductDetailPage from './pages/admin/ProductDetailPage';
import ResellerLayout from './pages/reseller/ResellerLayout';
import ResellerDashboardPage from './pages/reseller/ResellerDashboardPage';
import ResellerOrdersPage from './pages/reseller/ResellerOrdersPage';
import CatalogPage from './pages/reseller/CatalogPage';
import CustomerLayout from './pages/customer/CustomerLayout';
import StorefrontPage from './pages/customer/StorefrontPage';
import OrderConfirmationPage from './pages/customer/OrderConfirmationPage';
import MyOrdersPage from './pages/customer/MyOrdersPage';
import MyLicensesPage from './pages/customer/MyLicensesPage';
import { ProtectedRoute } from './auth/ProtectedRoute';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCustomerPage />} />
      <Route path="/register-reseller" element={<RegisterResellerPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['master_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="products" element={<ProductsListPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
      </Route>
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin', 'reseller_staff']}>
            <ResellerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ResellerDashboardPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="orders" element={<ResellerOrdersPage />} />
      </Route>
      <Route
        path="/account"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/account/store" replace />} />
        <Route path="store" element={<StorefrontPage />} />
        <Route path="orders" element={<MyOrdersPage />} />
        <Route path="orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="licenses" element={<MyLicensesPage />} />
      </Route>
    </Routes>
  );
}
