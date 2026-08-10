import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';
import { PageHeader } from './page-header';
import { EmptyState } from './empty-state';

interface ComingSoonPageProps {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}

/** Placeholder for nav destinations whose backend isn't built yet — keeps the IA complete and honest instead of a dead link or 404. */
export function ComingSoonPage({ eyebrow, title, description, icon }: ComingSoonPageProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="rounded-lg border border-border bg-surface shadow-card">
        <EmptyState
          icon={icon ?? Construction}
          title="Coming soon"
          description="This area is on the roadmap and isn't wired up yet."
        />
      </div>
    </div>
  );
}
