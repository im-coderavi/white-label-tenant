import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Boxes,
  CreditCard,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  Wallet,
} from 'lucide-react';
import DashboardLayout, { type NavItem } from '../../components/layout/DashboardLayout';
import { listCategories, buildCategoryTree } from '../../api/categories';

export default function ResellerLayout(): JSX.Element {
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const tree = categories ? buildCategoryTree(categories) : [];

  const nav: NavItem[] = [
    { to: '/reseller', label: 'Overview', icon: LayoutDashboard, end: true },
    {
      label: 'Marketplace',
      icon: Store,
      children: [
        { to: '/reseller/marketplace', label: 'All Products', end: true },
        { to: '/reseller/marketplace?featured=1', label: 'Featured Products' },
        { to: '/reseller/catalog', label: 'My Live Products' },
      ],
    },
    ...(tree.length > 0
      ? ([
          {
            label: 'Categories',
            icon: FolderTree,
            children: tree.map((group) => ({
              to: `/reseller/marketplace?category=${group._id}`,
              label: group.name,
            })),
          },
        ] as NavItem[])
      : []),
    { to: '/reseller/my-products', label: 'My Products', icon: Package },
    { to: '/reseller/orders', label: 'Orders', icon: ShoppingCart },
    { to: '/reseller/licenses', label: 'Licenses', icon: KeyRound },
    { to: '/reseller/subscription', label: 'Subscription', icon: CreditCard },
    { to: '/reseller/wallet', label: 'Wallet / Earnings', icon: Wallet },
    { to: '/reseller/coupons', label: 'Coupons', icon: Tag },
    {
      label: 'My Store',
      icon: Boxes,
      children: [
        { to: '/reseller/domain', label: 'Custom Domain & DNS' },
        { to: '/reseller/store-settings', label: 'Store Settings & Selling' },
        { to: '/reseller/payments', label: 'Payments & SMTP' },
        { to: '/reseller/grant-access', label: 'Grant Product Access' },
        { to: '/reseller/customers', label: 'Customers & Access Codes' },
      ],
    },
    {
      label: 'Store Customizer',
      icon: Palette,
      children: [
        { to: '/reseller/setup', label: 'Website Setup' },
        { to: '/reseller/templates', label: 'Landing Templates & HTML' },
      ],
    },
    { to: '/reseller/marketing', label: 'Marketing', icon: Megaphone },
    { to: '/reseller/tutorials', label: 'Tutorials & Guides', icon: BookOpen },
    { to: '/reseller/settings', label: 'Settings', icon: Settings },
  ];

  return <DashboardLayout sectionLabel="Reseller Admin" nav={nav} />;
}
