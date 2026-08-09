import { Tag } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function CouponsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Coupons & Offers"
      description="Platform-wide and per-reseller discount codes."
      icon={Tag}
    />
  );
}
