import { Users } from 'lucide-react';
import { ComingSoonPage } from '../../components/ui/coming-soon';

export default function AdminUsersPage(): JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="Master admin"
      title="Admin Users"
      description="Manage master-admin team members, their roles, and permissions."
      icon={Users}
    />
  );
}
