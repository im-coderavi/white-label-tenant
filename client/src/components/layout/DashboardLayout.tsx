import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Brand } from './Brand';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Marks the index route so it only highlights on an exact match. */
  end?: boolean;
}

interface DashboardLayoutProps {
  sectionLabel: string;
  nav: NavItem[];
}

/** Shared sidebar shell for the operator-facing areas (master admin, reseller). */
export default function DashboardLayout({ sectionLabel, nav }: DashboardLayoutProps): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const navLinks = nav.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-secondary hover:text-foreground'
        )
      }
    >
      <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
      {item.label}
    </NavLink>
  ));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Sidebar — static on desktop, slide-over on small screens */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Brand />
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="text-muted hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-3 text-eyebrow uppercase text-muted">{sectionLabel}</p>
          <div className="flex flex-col gap-0.5">{navLinks}</div>
        </nav>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/30 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="text-muted hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm font-medium text-muted sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
