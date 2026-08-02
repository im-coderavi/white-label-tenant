import { LayoutGrid } from 'lucide-react';
import DashboardLayout, { type NavItem } from '../../components/layout/DashboardLayout';

const NAV: NavItem[] = [{ to: '/reseller/catalog', label: 'Catalog', icon: LayoutGrid }];

export default function ResellerLayout(): JSX.Element {
  return <DashboardLayout sectionLabel="Reseller" nav={NAV} />;
}
