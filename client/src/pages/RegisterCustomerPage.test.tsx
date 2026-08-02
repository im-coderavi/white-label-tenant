import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterCustomerPage from './RegisterCustomerPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn() },
}));

function renderPage(): void {
  render(
    <MemoryRouter>
      <RegisterCustomerPage />
    </MemoryRouter>
  );
}

describe('RegisterCustomerPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('shows a success message after registering', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: '1', status: 'pending' } } });
    renderPage();

    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme');
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      tenantSubdomain: 'acme',
      email: 'buyer@example.com',
      password: 'longenough1',
    });
  });

  it('shows validation error for a short password', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText('Store subdomain'), 'acme');
    await userEvent.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });
});
