import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../lib/api';
import { loadStoredAuth, saveStoredAuth, clearStoredAuth } from '../lib/tokenStorage';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

function TestComponent(): JSX.Element {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <button onClick={() => login({ email: 'a@example.com', password: 'pw' })}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    clearStoredAuth();
  });

  it('restores a user from a valid stored token on mount', async () => {
    saveStoredAuth({ accessToken: 'a', refreshToken: 'b' });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'restored@example.com', role: 'customer', tenantId: 't1' } },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('restored@example.com');
  });

  it('logs in, persists tokens, and logs out clearing them', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: '2', email: 'new@example.com', role: 'customer', tenantId: 't1' },
      },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('new@example.com'));
    expect(loadStoredAuth()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(loadStoredAuth()).toBeNull();
  });
});
