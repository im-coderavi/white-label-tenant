import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import * as AuthContextModule from '../auth/AuthContext';

vi.mock('../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../auth/AuthContext')>('../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderLoginPage(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<div>Admin Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(AuthContextModule.useAuth).mockReset();
  });

  it('shows validation errors for empty submit', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
  });

  it('logs in and redirects to the role home route', async () => {
    const login = vi
      .fn()
      .mockResolvedValue({ id: '1', email: 'a@example.com', role: 'master_admin', tenantId: null });
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login,
      logout: vi.fn(),
    });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email Address'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Admin Home')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'longenough1',
      tenantSubdomain: undefined,
    });
  });

  it('passes a filled-in store subdomain through unchanged', async () => {
    const login = vi
      .fn()
      .mockResolvedValue({ id: '2', email: 'r@example.com', role: 'reseller_admin', tenantId: 't1' });
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login,
      logout: vi.fn(),
    });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email Address'), 'r@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.type(screen.getByLabelText('Store Subdomain / Slug (Optional)'), 'acme');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(login).toHaveBeenCalledWith({
      email: 'r@example.com',
      password: 'longenough1',
      tenantSubdomain: 'acme',
    });
  });
});
