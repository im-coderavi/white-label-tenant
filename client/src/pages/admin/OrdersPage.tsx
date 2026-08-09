import { Receipt } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ComingSoonPage } from '../../components/ui/coming-soon';

const STATUS_TITLE: Record<string, string> = {
  paid: 'Paid Orders',
  pending: 'Pending Orders',
  failed: 'Failed Orders',
  refunded: 'Refunds',
};

export default function OrdersPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');

  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title={status ? STATUS_TITLE[status] ?? 'Orders' : 'All Orders'}
      description="Cross-tenant order ledger — every purchase across every reseller store."
      icon={Receipt}
    />
  );
}
