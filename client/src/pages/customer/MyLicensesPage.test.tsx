import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyLicensesPage from './MyLicensesPage';
import * as api from '../../api/customerOrders';

vi.mock('../../api/customerOrders', () => ({
  listMyLicenses: vi.fn(),
  activateLicense: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyLicensesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const spare = {
  _id: 'lic-1',
  key: 'TZP-2026-AAAA1111',
  status: 'assigned',
  activationLimit: 3,
  activationsUsed: 1,
  expiresAt: null,
  orderId: 'order-1',
  product: { _id: 'p1', name: 'AI Copywriter Studio', type: 'ai_tool' },
};

const exhausted = {
  _id: 'lic-2',
  key: 'TZP-2026-BBBB2222',
  status: 'activated',
  activationLimit: 1,
  activationsUsed: 1,
  expiresAt: null,
  orderId: 'order-2',
  product: { _id: 'p2', name: 'SEO Booster Plugin', type: 'plugin' },
};

describe('MyLicensesPage', () => {
  beforeEach(() => {
    vi.mocked(api.listMyLicenses).mockReset();
    vi.mocked(api.activateLicense).mockReset();
  });

  it('shows an empty state when no licenses are held', async () => {
    vi.mocked(api.listMyLicenses).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText('No licenses yet')).toBeInTheDocument();
  });

  it('shows each key with its product and activation count', async () => {
    vi.mocked(api.listMyLicenses).mockResolvedValueOnce([spare]);
    renderPage();

    expect(await screen.findByText('TZP-2026-AAAA1111')).toBeInTheDocument();
    expect(screen.getByText('AI Copywriter Studio')).toBeInTheDocument();
    expect(screen.getByText('Activations used 1 of 3')).toBeInTheDocument();
  });

  it('activates a license and refreshes the list', async () => {
    vi.mocked(api.listMyLicenses)
      .mockResolvedValueOnce([spare])
      .mockResolvedValueOnce([{ ...spare, activationsUsed: 2, status: 'activated' }]);
    vi.mocked(api.activateLicense).mockResolvedValueOnce(undefined);
    renderPage();

    await screen.findByText('TZP-2026-AAAA1111');
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(api.activateLicense).toHaveBeenCalledWith('lic-1'));
    expect(await screen.findByText('Activations used 2 of 3')).toBeInTheDocument();
  });

  it('disables activation once the limit is reached', async () => {
    vi.mocked(api.listMyLicenses).mockResolvedValueOnce([exhausted]);
    renderPage();

    const card = (await screen.findByText('SEO Booster Plugin')).closest('li') as HTMLElement;
    expect(within(card).getByRole('button', { name: 'Activate' })).toBeDisabled();
  });

  it('shows an inline error when activation fails', async () => {
    vi.mocked(api.listMyLicenses).mockResolvedValue([spare]);
    vi.mocked(api.activateLicense).mockRejectedValueOnce(new Error('nope'));
    renderPage();

    await screen.findByText('TZP-2026-AAAA1111');
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not activate this license.');
  });
});
