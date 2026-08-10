import { FileKey } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function LicenseRequestsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Manual License Requests"
      description="Approve or reject resellers' manual license requests."
      icon={FileKey}
    />
  );
}
