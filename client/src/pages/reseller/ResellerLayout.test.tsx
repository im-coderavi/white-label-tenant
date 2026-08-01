import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResellerLayout from './ResellerLayout';
import * as AuthContextModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../auth/AuthContext')>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

describe('ResellerLayout', () => {
  it('shows the user email, renders nested content, and logs out on click', async () => {
    const logout = vi.fn();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'reseller@example.com', role: 'reseller_admin', tenantId: 'tenant-1' },
      isLoading: false,
      login: vi.fn(),
      logout,
    });

    render(
      <MemoryRouter initialEntries={['/reseller']}>
        <Routes>
          <Route path="/reseller" element={<ResellerLayout />}>
            <Route index element={<div>Nested content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('reseller@example.com')).toBeInTheDocument();
    expect(screen.getByText('Nested content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});
