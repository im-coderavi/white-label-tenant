import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterCustomerPage from './pages/RegisterCustomerPage';
import RegisterResellerPage from './pages/RegisterResellerPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import PreviewPage from './pages/PreviewPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ProductsListPage from './pages/admin/ProductsListPage';
import ProductFormPage from './pages/admin/ProductFormPage';
import ProductDetailPage from './pages/admin/ProductDetailPage';
import ResellersPage from './pages/admin/ResellersPage';
import ResellerDetailPage from './pages/admin/ResellerDetailPage';
import PlansPage from './pages/admin/PlansPage';
import SubscriptionsPage from './pages/admin/SubscriptionsPage';
import RenewalsPage from './pages/admin/RenewalsPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import LicensesPage from './pages/admin/LicensesPage';
import ProductSyncStatusPage from './pages/admin/ProductSyncStatusPage';
import LicenseRequestsPage from './pages/admin/LicenseRequestsPage';
import OrdersPage from './pages/admin/OrdersPage';
import CouponsPage from './pages/admin/CouponsPage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import ReportsPage from './pages/admin/ReportsPage';
import PlatformSettingsPage from './pages/admin/PlatformSettingsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import ResellerLayout from './pages/reseller/ResellerLayout';
import ResellerDashboardPage from './pages/reseller/ResellerDashboardPage';
import ResellerOrdersPage from './pages/reseller/ResellerOrdersPage';
import CatalogPage from './pages/reseller/CatalogPage';
import StoreSettingsPage from './pages/reseller/StoreSettingsPage';
import WebsiteSetupPage from './pages/reseller/WebsiteSetupPage';
import LandingPageTemplatesPage from './pages/reseller/LandingPageTemplatesPage';
import DomainManagementPage from './pages/reseller/DomainManagementPage';
import AccessCodesPage from './pages/reseller/AccessCodesPage';
import TutorialsPage from './pages/reseller/TutorialsPage';
import PaymentsPage from './pages/reseller/PaymentsPage';
import GrantAccessPage from './pages/reseller/GrantAccessPage';
import MarketplacePage from './pages/reseller/MarketplacePage';
import MarketplaceOrderConfirmationPage from './pages/reseller/MarketplaceOrderConfirmationPage';
import MyProductsPage from './pages/reseller/MyProductsPage';
import ResellerLicensesPage from './pages/reseller/LicensesPage';
import SubscriptionPage from './pages/reseller/SubscriptionPage';
import WalletPage from './pages/reseller/WalletPage';
import ResellerCouponsPage from './pages/reseller/ResellerCouponsPage';
import ResellerMarketingPage from './pages/reseller/ResellerMarketingPage';
import ResellerSettingsPage from './pages/reseller/ResellerSettingsPage';
import CustomerLayout from './pages/customer/CustomerLayout';
import StorefrontPage from './pages/customer/StorefrontPage';
import OrderConfirmationPage from './pages/customer/OrderConfirmationPage';
import MyOrdersPage from './pages/customer/MyOrdersPage';
import MyLicensesPage from './pages/customer/MyLicensesPage';
import CustomerProductDetailPage from './pages/customer/ProductDetailPage';
import { ProtectedRoute } from './auth/ProtectedRoute';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCustomerPage />} />
      <Route path="/register-reseller" element={<RegisterResellerPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/preview" element={<PreviewPage />} />

      {/* Master Admin Routes */}
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
        <Route path="resellers" element={<ResellersPage />} />
        <Route path="resellers/:id" element={<ResellerDetailPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="renewals" element={<RenewalsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="licenses" element={<LicensesPage />} />
        <Route path="products/sync-status" element={<ProductSyncStatusPage />} />
        <Route path="license-requests" element={<LicenseRequestsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<PlatformSettingsPage />} />
        <Route path="admin-users" element={<AdminUsersPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
      </Route>

      {/* Reseller Admin Routes */}
      <Route
        path="/reseller"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin', 'reseller_staff']}>
            <ResellerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ResellerDashboardPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="marketplace/orders/:orderId" element={<MarketplaceOrderConfirmationPage />} />
        <Route path="my-products" element={<MyProductsPage />} />
        <Route path="setup" element={<WebsiteSetupPage />} />
        <Route path="templates" element={<LandingPageTemplatesPage />} />
        <Route path="domain" element={<DomainManagementPage />} />
        <Route path="store-settings" element={<StoreSettingsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="grant-access" element={<GrantAccessPage />} />
        <Route path="customers" element={<AccessCodesPage />} />
        <Route path="orders" element={<ResellerOrdersPage />} />
        <Route path="licenses" element={<ResellerLicensesPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="coupons" element={<ResellerCouponsPage />} />
        <Route path="marketing" element={<ResellerMarketingPage />} />
        <Route path="settings" element={<ResellerSettingsPage />} />
        <Route path="tutorials" element={<TutorialsPage />} />
      </Route>

      {/* Customer Routes */}
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
        <Route path="products/:productId" element={<CustomerProductDetailPage />} />
        <Route path="orders" element={<MyOrdersPage />} />
        <Route path="orders/:orderId" element={<OrderConfirmationPage />} />
        <Route path="licenses" element={<MyLicensesPage />} />
      </Route>
    </Routes>
  );
}
