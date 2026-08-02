import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResellerDashboardPage from './ResellerDashboardPage';
import * as api from '../../api/resellerAccount';

vi.mock('../../api/resellerAccount', () => ({
  getSubscription: vi.fn(),
  getResellerStats: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ResellerDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const stats = {
  catalogTotal: 18,
  catalogLive: 12,
  ordersTotal: 5,
  ordersPaid: 4,
  revenue: 12500,
  customers: 3,
};

const activeSubscription = {
  _id: 'sub-1',
  status: 'active',
  currentPeriodEnd: '2027-08-01T00:00:00.000Z',
  daysRemaining: 364,
  licenseKey: 'TZP-RS-2026-ABCD1234',
  plan: {
    _id: 'plan-1',
    name: 'Premium',
    price: 4999,
    currency: 'INR',
    billingCycle: 'annual' as const,
  },
};

describe('ResellerDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(api.getSubscription).mockReset();
    vi.mocked(api.getResellerStats).mockReset().mockResolvedValue(stats);
  });

  it('shows the subscription key, plan, and days remaining', async () => {
    vi.mocked(api.getSubscription).mockResolvedValueOnce(activeSubscription);
    renderPage();

    expect(await screen.findByText('TZP-RS-2026-ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('364')).toBeInTheDocument();
  });

  it('shows store totals', async () => {
    vi.mocked(api.getSubscription).mockResolvedValueOnce(activeSubscription);
    renderPage();

    expect(await screen.findByText('12500')).toBeInTheDocument();
    expect(screen.getByText('12 of 18')).toBeInTheDocument();
  });

  it('prompts to pick a plan when the store has no subscription', async () => {
    vi.mocked(api.getSubscription).mockResolvedValueOnce(null);
    renderPage();

    expect(await screen.findByText('No plan selected')).toBeInTheDocument();
    expect(screen.queryByText(/^TZP-RS-/)).not.toBeInTheDocument();
  });

  it('warns when the subscription has lapsed', async () => {
    vi.mocked(api.getSubscription).mockResolvedValueOnce({
      ...activeSubscription,
      status: 'expired',
      daysRemaining: 0,
    });
    renderPage();

    expect(await screen.findByText('Your store is not accepting new orders.')).toBeInTheDocument();
  });
});
