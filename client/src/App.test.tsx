import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { api } from './lib/api';

vi.mock('./lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function renderApp(initialPath: string): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    localStorage.clear();
  });

  it('redirects the root path to /login', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('logs in as master_admin and lands on the admin home page', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: '1', email: 'admin@example.com', role: 'master_admin', tenantId: null },
      },
    });

    renderApp('/login');

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Welcome, admin@example.com (master_admin)')).toBeInTheDocument();
  });

  it('redirects an unauthenticated visit to /admin back to /login', async () => {
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});
