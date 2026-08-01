import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductFormPage from './ProductFormPage';
import * as adminProductsApi from '../../api/adminProducts';

vi.mock('../../api/adminProducts', () => ({
  createProduct: vi.fn(),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/products/new']}>
      <Routes>
        <Route path="/admin/products/new" element={<ProductFormPage />} />
        <Route path="/admin/products/:id" element={<div>Product detail placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProductFormPage', () => {
  beforeEach(() => {
    vi.mocked(adminProductsApi.createProduct).mockReset();
  });

  it('shows a validation error for an empty name', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
  });

  it('creates a product and navigates to its detail page', async () => {
    vi.mocked(adminProductsApi.createProduct).mockResolvedValueOnce({
      _id: 'new-product-1',
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
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Super Tool');
    await userEvent.type(screen.getByLabelText('Base price'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Create product' }));

    expect(await screen.findByText('Product detail placeholder')).toBeInTheDocument();
    expect(adminProductsApi.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Super Tool', basePrice: 100 })
    );
  });
});
