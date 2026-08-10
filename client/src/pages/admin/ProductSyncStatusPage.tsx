import { RefreshCw } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function ProductSyncStatusPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Sync Status"
      description="Rollout status of catalog updates across every reseller store."
      icon={RefreshCw}
    />
  );
}
