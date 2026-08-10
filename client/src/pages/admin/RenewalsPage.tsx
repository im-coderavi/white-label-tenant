import { RefreshCw } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function RenewalsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Renewals"
      description="Upcoming and overdue reseller plan renewals."
      icon={RefreshCw}
    />
  );
}
