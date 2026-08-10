import { CreditCard } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function SubscriptionsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Subscriptions"
      description="Every active reseller subscription across all plans."
      icon={CreditCard}
    />
  );
}
