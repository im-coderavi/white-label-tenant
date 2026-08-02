import { Store } from 'lucide-react';
import StorefrontLayout, { type StorefrontNavItem } from '../../components/layout/StorefrontLayout';

const NAV: StorefrontNavItem[] = [{ to: '/account/store', label: 'Store', icon: Store }];

export default function CustomerLayout(): JSX.Element {
  return <StorefrontLayout nav={NAV} />;
}
