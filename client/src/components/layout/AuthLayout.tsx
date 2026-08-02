import * as React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Brand } from './Brand';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  /** Short proof points shown on the brand panel; keep to three. */
  highlights: string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  highlights,
  children,
  footer,
}: AuthLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel — the only place the gradient runs full-bleed. */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-accent p-12 text-primary-foreground lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Link to="/login" className="inline-flex text-primary-foreground [&_.text-primary]:text-white">
            <Brand />
          </Link>
        </div>
        <div className="relative mt-auto">
          <h2 className="max-w-md font-display text-[2rem] font-extrabold leading-[1.15] text-white">
            Sell digital products under your own brand.
          </h2>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-white/75">
            Run a storefront, set your own prices, and deliver every order with a license key the moment
            payment clears.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[26rem] animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-[1.75rem] font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
