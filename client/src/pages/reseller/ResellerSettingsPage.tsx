import { Settings } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function ResellerSettingsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Your store"
      title="Settings"
      description="Account preferences, notification settings, and staff access."
      icon={Settings}
    />
  );
}
