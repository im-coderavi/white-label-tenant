import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductsListPage from './ProductsListPage';
import * as adminProductsApi from '../../api/adminProducts';

vi.mock('../../api/adminProducts', () => ({
  listProducts: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProductsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductsListPage', () => {
  beforeEach(() => {
    vi.mocked(adminProductsApi.listProducts).mockReset();
  });

  it('renders fetched products', async () => {
    vi.mocked(adminProductsApi.listProducts).mockResolvedValueOnce({
      items: [
        {
          _id: 'p1',
          name: 'Super Tool',
          slug: 'super-tool',
          type: 'software',
          description: '',
          basePrice: 100,
          currency: 'INR',
          status: 'draft',
          syncMode: 'optional',
          tenantId: null,
          currentVersion: null,
          thumbnailUrl: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderPage();

    expect(await screen.findByText('Super Tool')).toBeInTheDocument();
  });

  it('re-queries when the search filter changes', async () => {
    vi.mocked(adminProductsApi.listProducts).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    renderPage();

    await waitFor(() => expect(adminProductsApi.listProducts).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByLabelText('Search products'), 'tool');

    await waitFor(() =>
      expect(adminProductsApi.listProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'tool' })
      )
    );
  });
});
