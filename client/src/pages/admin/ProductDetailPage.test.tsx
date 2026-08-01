import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductDetailPage from './ProductDetailPage';
import * as adminProductsApi from '../../api/adminProducts';
import * as adminTenantsApi from '../../api/adminTenants';

vi.mock('../../api/adminProducts', () => ({
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  archiveProduct: vi.fn(),
  publishProduct: vi.fn(),
  updateSyncMode: vi.fn(),
  listVersions: vi.fn(),
  addVersion: vi.fn(),
}));
vi.mock('../../api/adminTenants', () => ({
  listTenants: vi.fn(),
}));

const baseProduct = {
  _id: 'product-1',
  name: 'Super Tool',
  slug: 'super-tool',
  type: 'software',
  description: 'A tool',
  basePrice: 100,
  currency: 'INR',
  status: 'draft',
  syncMode: 'optional',
  tenantId: null,
  currentVersion: null,
  thumbnailUrl: null,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/products/product-1']}>
        <Routes>
          <Route path="/admin/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductDetailPage', () => {
  beforeEach(() => {
    vi.mocked(adminProductsApi.getProduct).mockReset().mockResolvedValue(baseProduct);
    vi.mocked(adminProductsApi.updateProduct).mockReset();
    vi.mocked(adminProductsApi.archiveProduct).mockReset();
    vi.mocked(adminProductsApi.publishProduct).mockReset();
    vi.mocked(adminProductsApi.listVersions).mockReset().mockResolvedValue([]);
    vi.mocked(adminTenantsApi.listTenants).mockReset().mockResolvedValue([]);
  });

  it('renders the product name and status', async () => {
    renderPage();
    expect(await screen.findByText('Super Tool')).toBeInTheDocument();
    expect(screen.getByText('Status: draft')).toBeInTheDocument();
  });

  it('saves info changes', async () => {
    vi.mocked(adminProductsApi.updateProduct).mockResolvedValueOnce({ ...baseProduct, basePrice: 200 });
    renderPage();
    await screen.findByText('Super Tool');

    const priceInput = screen.getByLabelText('Base price');
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '200');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(adminProductsApi.updateProduct).toHaveBeenCalledWith(
        'product-1',
        expect.objectContaining({ basePrice: 200 })
      )
    );
  });

  it('shows an inline message when publish fails', async () => {
    vi.mocked(adminProductsApi.publishProduct).mockRejectedValueOnce(new Error('conflict'));
    renderPage();
    await screen.findByText('Super Tool');

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Add a version before publishing')).toBeInTheDocument();
  });

  it('archives the product', async () => {
    vi.mocked(adminProductsApi.archiveProduct).mockResolvedValueOnce({ ...baseProduct, status: 'archived' });
    renderPage();
    await screen.findByText('Super Tool');

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(adminProductsApi.archiveProduct).toHaveBeenCalledWith('product-1'));
  });
});
