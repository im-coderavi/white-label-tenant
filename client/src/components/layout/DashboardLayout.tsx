import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Brand } from './Brand';

interface NavLeafItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Marks the index route so it only highlights on an exact match. */
  end?: boolean;
  children?: undefined;
  /** Badge text shown next to the label, e.g. a plan-gated feature's tier requirement. */
  badge?: string;
}

interface NavGroupItem {
  to?: undefined;
  label: string;
  icon: LucideIcon;
  end?: undefined;
  /** Nested links shown under this item as a collapsible group. */
  children: Array<{ to: string; label: string; end?: boolean }>;
  badge?: string;
}

export type NavItem = NavLeafItem | NavGroupItem;

interface DashboardLayoutProps {
  sectionLabel: string;
  nav: NavItem[];
}

function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate: () => void }): JSX.Element {
  const location = useLocation();
  const hasActiveChild = item.children?.some((child) => location.pathname.startsWith(child.to)) ?? false;
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
          hasActiveChild ? 'text-primary' : 'text-muted hover:bg-secondary hover:text-foreground'
        )}
        aria-expanded={open}
      >
        <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="ml-[1.6rem] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.children!.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted hover:bg-secondary hover:text-foreground'
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
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

  const navLinks = nav.map((item) =>
    item.children ? (
      <NavGroup key={item.label} item={item} onNavigate={() => setMenuOpen(false)} />
    ) : (
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
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-accent">
            {item.badge}
          </span>
        )}
      </NavLink>
    )
  );

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
