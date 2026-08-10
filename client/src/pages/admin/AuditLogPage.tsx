import { ShieldCheck } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function AuditLogPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Activity Logs"
      description="Every state-changing action across the platform, with before/after values."
      icon={ShieldCheck}
    />
  );
}
