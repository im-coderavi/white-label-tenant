import { Settings } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function PlatformSettingsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Settings"
      description="General, email, payment gateway, license, and system-wide platform settings."
      icon={Settings}
    />
  );
}
