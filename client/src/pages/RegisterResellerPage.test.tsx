import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RegisterResellerPage from './RegisterResellerPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RegisterResellerPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('lists fetched plans and submits registration', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        plans: [{ _id: 'plan-1', name: 'Starter Annual', price: 999, currency: 'INR', billingCycle: 'annual' }],
      },
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { gatewayOrderId: 'mock_order_1', amount: 999, currency: 'INR' },
    });

    renderWithClient(<RegisterResellerPage />);

    expect(await screen.findByText('Starter Annual — 999 INR')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Business name'), 'Acme Resell');
    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme-resell');
    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'plan-1');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/Almost there/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register-reseller', {
      businessName: 'Acme Resell',
      subdomain: 'acme-resell',
      email: 'owner@example.com',
      password: 'longenough1',
      planId: 'plan-1',
    });
  });
});
