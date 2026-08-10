import { Bell } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function AnnouncementsPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Announcements"
      description="Broadcast a banner or notice to every reseller dashboard."
      icon={Bell}
    />
  );
}
