import { BarChart3 } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function ReportsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Reports & Analytics"
      description="Revenue, reseller performance, and product analytics across the platform."
      icon={BarChart3}
    />
  );
}
