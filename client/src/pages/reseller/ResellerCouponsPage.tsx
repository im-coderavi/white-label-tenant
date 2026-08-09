import { Tag } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function ResellerCouponsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Your store"
      title="Coupons"
      description="Create discount codes for your storefront."
      icon={Tag}
    />
  );
}
