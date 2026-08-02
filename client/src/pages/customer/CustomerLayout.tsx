import { KeyRound, Receipt, Store } from 'lucide-react';
import StorefrontLayout, { type StorefrontNavItem } from '../../components/layout/StorefrontLayout';

const NAV: StorefrontNavItem[] = [
  { to: '/account/store', label: 'Store', icon: Store },
  { to: '/account/orders', label: 'Orders', icon: Receipt },
  { to: '/account/licenses', label: 'Licenses', icon: KeyRound },
];

export default function CustomerLayout(): JSX.Element {
  return <StorefrontLayout nav={NAV} />;
}
