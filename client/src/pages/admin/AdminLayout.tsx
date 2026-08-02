import { LayoutDashboard, Package } from 'lucide-react';
import DashboardLayout, { type NavItem } from '../../components/layout/DashboardLayout';

const NAV: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
];

export default function AdminLayout(): JSX.Element {
  return <DashboardLayout sectionLabel="Master admin" nav={NAV} />;
}
