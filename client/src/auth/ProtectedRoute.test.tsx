import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContextModule from './AuthContext';

vi.mock('./AuthContext', async () => {
  const actual = await vi.importActual<typeof import('./AuthContext')>('./AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

function renderWithRoute(initialPath: string): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['master_admin']}>
              <div>Admin Home</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute('/admin');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /unauthorized for a wrong role', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'a@example.com', role: 'customer', tenantId: null },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute('/admin');
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });

  it('renders children for an allowed role', () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: { id: '1', email: 'a@example.com', role: 'master_admin', tenantId: null },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWithRoute('/admin');
    expect(screen.getByText('Admin Home')).toBeInTheDocument();
  });
});
