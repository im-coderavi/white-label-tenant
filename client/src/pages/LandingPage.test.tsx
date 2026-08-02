import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './LandingPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('leads with the storefront pitch and both sign-up paths', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { plans: [] } });
    renderPage();

    // The header and footer repeat these calls to action, so scope to the hero.
    const hero = within(screen.getByRole('main'));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every sale ships a key');
    expect(hero.getByRole('link', { name: 'Start reselling' })).toHaveAttribute(
      'href',
      '/register-reseller'
    );
    expect(hero.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('lists the plans the platform actually offers', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        plans: [
          { _id: 'plan-1', name: 'Starter', price: 999, currency: 'INR', billingCycle: 'monthly' },
          { _id: 'plan-2', name: 'Lifetime', price: 14999, currency: 'INR', billingCycle: 'lifetime' },
        ],
      },
    });
    renderPage();

    expect(await screen.findByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Lifetime')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.getByText('per month')).toBeInTheDocument();
    expect(screen.getByText('one time')).toBeInTheDocument();
  });

  it('falls back to a quiet message when plans cannot be loaded', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByText('Plans are unavailable right now.')).toBeInTheDocument();
  });
});
