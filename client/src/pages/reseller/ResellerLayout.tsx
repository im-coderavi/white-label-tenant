import { LayoutDashboard, LayoutGrid, ShoppingCart } from 'lucide-react';
import DashboardLayout, { type NavItem } from '../../components/layout/DashboardLayout';

const NAV: NavItem[] = [
  { to: '/reseller', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reseller/catalog', label: 'Catalog', icon: LayoutGrid },
  { to: '/reseller/orders', label: 'Sales', icon: ShoppingCart },
];

export default function ResellerLayout(): JSX.Element {
  return <DashboardLayout sectionLabel="Reseller" nav={NAV} />;
}
