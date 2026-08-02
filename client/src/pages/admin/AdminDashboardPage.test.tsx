import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboardPage from './AdminDashboardPage';
import * as api from '../../api/adminStats';

vi.mock('../../api/adminStats', () => ({
  getPlatformStats: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(api.getPlatformStats).mockReset();
  });

  it('reports platform totals', async () => {
    vi.mocked(api.getPlatformStats).mockResolvedValueOnce({
      tenantsTotal: 7,
      tenantsActive: 5,
      productsTotal: 20,
      productsPublished: 18,
      subscriptionsActive: 5,
      ordersPaid: 42,
      revenue: 98500,
      licensesIssued: 40,
    });
    renderPage();

    expect(await screen.findByText('98500')).toBeInTheDocument();
    expect(screen.getByText('5 of 7')).toBeInTheDocument();
    expect(screen.getByText('18 of 20')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('stays quiet when stats cannot be loaded', async () => {
    vi.mocked(api.getPlatformStats).mockRejectedValueOnce(new Error('offline'));
    renderPage();
    expect(await screen.findByText('Stats are unavailable right now.')).toBeInTheDocument();
  });
});
