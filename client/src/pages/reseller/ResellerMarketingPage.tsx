import { Megaphone } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function ResellerMarketingPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Your store"
      title="Marketing"
      description="Announcement banners, email campaigns, and promo tools for your storefront."
      icon={Megaphone}
    />
  );
}
