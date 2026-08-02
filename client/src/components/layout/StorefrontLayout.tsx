import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Brand } from './Brand';

export interface StorefrontNavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
}

interface StorefrontLayoutProps {
  nav: StorefrontNavItem[];
}

/** Buyer-facing shell. Shoppers browse across a wide canvas, so navigation sits on top. */
export default function StorefrontLayout({ nav }: StorefrontLayoutProps): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:bg-secondary hover:text-foreground'
                  )
                }
              >
                {item.icon && <item.icon className="size-4" aria-hidden="true" />}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm font-medium text-muted sm:inline">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl animate-fade-up px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted sm:px-6 lg:px-8">
          Every purchase is delivered with a license key and an instant download.
        </div>
      </footer>
    </div>
  );
}
