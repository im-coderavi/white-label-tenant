import {
  BarChart3,
  Bell,
  CreditCard,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  Users,
} from 'lucide-react';
import DashboardLayout, { type NavItem } from '../../components/layout/DashboardLayout';

const NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  {
    label: 'Resellers',
    icon: Store,
    children: [
      { to: '/admin/resellers', label: 'All Resellers', end: true },
      { to: '/admin/resellers?status=active', label: 'Active' },
      { to: '/admin/resellers?status=suspended', label: 'Suspended' },
      { to: '/admin/resellers?status=pending', label: 'Pending' },
    ],
  },
  {
    label: 'Subscription Plans',
    icon: CreditCard,
    children: [
      { to: '/admin/plans', label: 'Plans', end: true },
      { to: '/admin/subscriptions', label: 'Subscriptions' },
      { to: '/admin/renewals', label: 'Renewals' },
    ],
  },
  {
    label: 'Global Products',
    icon: Package,
    children: [
      { to: '/admin/products', label: 'All Products', end: true },
      { to: '/admin/products/new', label: 'Add Product' },
      { to: '/admin/products/sync-status', label: 'Sync Status' },
    ],
  },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  {
    label: 'License Keys',
    icon: KeyRound,
    children: [
      { to: '/admin/licenses', label: 'Key Pool', end: true },
      { to: '/admin/licenses?status=assigned', label: 'Issued Keys' },
      { to: '/admin/licenses?status=expired', label: 'Expired Keys' },
      { to: '/admin/license-requests', label: 'Manual Requests' },
    ],
  },
  {
    label: 'Orders',
    icon: Receipt,
    children: [
      { to: '/admin/orders', label: 'All Orders', end: true },
      { to: '/admin/orders?status=paid', label: 'Paid' },
      { to: '/admin/orders?status=pending', label: 'Pending' },
      { to: '/admin/orders?status=failed', label: 'Failed' },
      { to: '/admin/orders?status=refunded', label: 'Refunds' },
    ],
  },
  { to: '/admin/coupons', label: 'Coupons & Offers', icon: Tag },
  { to: '/admin/announcements', label: 'Announcements', icon: Bell },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/admin-users', label: 'Admin Users', icon: Users },
  { to: '/admin/audit-log', label: 'Activity Logs', icon: ShieldCheck },
];

export default function AdminLayout(): JSX.Element {
  return <DashboardLayout sectionLabel="Master admin" nav={NAV} />;
}
