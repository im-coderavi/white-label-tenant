import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Brand } from '../components/layout/Brand';

interface Plan {
  _id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'annual' | 'lifetime';
}

const CYCLE_LABEL: Record<Plan['billingCycle'], string> = {
  monthly: 'per month',
  annual: 'per year',
  lifetime: 'one time',
};

/** A real sequence, so the numbering carries information rather than decorating. */
const STEPS = [
  {
    title: 'Pick a plan',
    body: 'Your store goes live on its own subdomain with the catalog already stocked.',
  },
  {
    title: 'Set your margin',
    body: 'Enable the products you want and charge a custom price or a flat discount off the base.',
  },
  {
    title: 'Get paid',
    body: 'When an order settles, the buyer’s license key is issued and the download unlocks.',
  },
];

const FAQ = [
  {
    q: 'What do I actually get?',
    a: 'A branded storefront on your own subdomain, stocked with digital products you are licensed to resell. You choose which ones to list.',
  },
  {
    q: 'Can I set my own prices?',
    a: 'Yes. Every product can carry a custom price or a percentage discount off the base price. Whatever you set is what your buyer pays.',
  },
  {
    q: 'How do buyers receive their purchase?',
    a: 'The moment payment clears, a license key is assigned to that order and the buyer can download the files from their account.',
  },
  {
    q: 'What happens when my plan lapses?',
    a: 'Your storefront stops accepting new orders, but your catalog settings and past orders are kept. Renewing puts the store straight back online.',
  },
];

function PublicHeader(): JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          <a
            href="#how-it-works"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-secondary hover:text-foreground"
          >
            How it works
          </a>
          <a
            href="#plans"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-secondary hover:text-foreground"
          >
            Plans
          </a>
          <a
            href="#faq"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-secondary hover:text-foreground"
          >
            FAQ
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register-reseller">Start reselling</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * The hero shows the moment the product exists for: an order clearing and a key
 * being handed over. That beats a generic dashboard mockup for this business.
 */
function KeyIssuedCard(): JSX.Element {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/15 to-accent/15 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative rounded-lg border border-border bg-surface p-6 shadow-pop">
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow uppercase text-muted">Order settled</p>
          <Badge tone="success">Paid</Badge>
        </div>
        <p className="mt-3 font-display text-lg font-bold">Ecommerce Starter Kit</p>
        <p className="text-sm text-muted">2,499 INR · Nova Digital</p>

        <div className="key-grid mt-5 rounded-md border border-dashed border-border p-4">
          <p className="flex items-center gap-1.5 text-eyebrow uppercase text-muted">
            <KeyRound className="size-3.5" aria-hidden="true" />
            License key
          </p>
          <p className="mt-2 font-mono text-base font-bold tracking-[0.12em]">TZP-2026-8KQD4M1P</p>
        </div>

        <p className="mt-4 flex items-center gap-2 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Issued automatically, no manual step
        </p>
      </div>
    </div>
  );
}

export default function LandingPage(): JSX.Element {
  const { data: plans, isError } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const res = await api.get<{ plans: Plan[] }>('/plans');
      return res.data.plans;
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <div className="animate-fade-up">
            <p className="text-eyebrow uppercase text-primary">White-label digital marketplace</p>
            <h1 className="mt-3 font-display text-[2.25rem] font-extrabold leading-[1.1] sm:text-[3rem]">
              Your storefront. Your prices.{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Every sale ships a key.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              ToolzyPro gives you a branded store stocked with digital products you can resell. Set your
              margin, take the order, and the license key goes out the moment payment clears.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/register-reseller">
                  Start reselling
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted">
              Buying instead?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Create a customer account
              </Link>
              .
            </p>
          </div>

          <div className="lg:pl-6">
            <KeyIssuedCard />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-eyebrow uppercase text-primary">How it works</p>
            <h2 className="mt-2 max-w-xl text-[1.75rem] font-bold">
              Three steps from signing up to getting paid.
            </h2>

            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="font-mono text-sm font-bold text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="mt-3 h-px w-full bg-border" aria-hidden="true" />
                  <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-eyebrow uppercase text-primary">Plans</p>
          <h2 className="mt-2 max-w-xl text-[1.75rem] font-bold">Pick the plan that fits your store.</h2>

          {isError ? (
            <p className="mt-8 text-sm text-muted">Plans are unavailable right now.</p>
          ) : (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {plans?.map((plan) => (
                <li
                  key={plan._id}
                  className="flex flex-col rounded-lg border border-border bg-surface p-6 shadow-card"
                >
                  <p className="font-display text-base font-semibold">{plan.name}</p>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-sm text-muted">{plan.currency}</span>
                    <span className="font-display text-3xl font-extrabold tabular-nums">{plan.price}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{CYCLE_LABEL[plan.billingCycle]}</p>
                  <Button asChild variant="outline" className="mt-6 w-full">
                    <Link to="/register-reseller">Choose {plan.name}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-eyebrow uppercase text-primary">FAQ</p>
            <h2 className="mt-2 text-[1.75rem] font-bold">Questions worth answering up front.</h2>

            <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-display text-base font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <Brand />
          <p className="text-sm text-muted">Digital products, resold under your own brand.</p>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link to="/login" className="text-muted hover:text-foreground">
              Log in
            </Link>
            <Link to="/register-reseller" className="font-medium text-primary hover:underline">
              Start reselling
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
