import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CatalogPage from './CatalogPage';
import * as resellerCatalogApi from '../../api/resellerCatalog';
import type { ResellerCatalogItem } from '../../api/resellerCatalog';

vi.mock('../../api/resellerCatalog', () => ({
  listCatalog: vi.fn(),
  updateCatalogItem: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CatalogPage />
    </QueryClientProvider>
  );
}

const globalItem: ResellerCatalogItem = {
  _id: 'rp-1',
  product: { _id: 'p-1', name: 'Global Tool', type: 'software', basePrice: 100, currency: 'INR' },
  syncMode: 'global',
  enabled: true,
  customPrice: null,
  discountPercent: null,
  isFeatured: false,
};

const optionalItem: ResellerCatalogItem = {
  _id: 'rp-2',
  product: { _id: 'p-2', name: 'Optional Tool', type: 'software', basePrice: 200, currency: 'INR' },
  syncMode: 'optional',
  enabled: false,
  customPrice: null,
  discountPercent: null,
  isFeatured: false,
};

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.mocked(resellerCatalogApi.listCatalog).mockReset();
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockReset();
  });

  it('shows a disabled, checked toggle for global products and an editable one for optional products', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([globalItem, optionalItem]);
    renderPage();

    const globalRow = (await screen.findByText('Global Tool')).closest('tr') as HTMLElement;
    const globalToggle = within(globalRow).getByRole('checkbox', { name: 'Enabled' });
    expect(globalToggle).toBeChecked();
    expect(globalToggle).toBeDisabled();

    const optionalRow = screen.getByText('Optional Tool').closest('tr') as HTMLElement;
    const optionalToggle = within(optionalRow).getByRole('checkbox', { name: 'Enabled' });
    expect(optionalToggle).not.toBeChecked();
    expect(optionalToggle).not.toBeDisabled();
  });

  it('enables an optional product and saves', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({ ...optionalItem, enabled: true });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Enabled' }));
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ enabled: true })
      )
    );
  });

  it('shows an inline error when saving fails', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockRejectedValueOnce(new Error('network error'));
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'Could not save changes. Please try again.'
    );
  });

  it('switches to custom pricing, reveals the price input, and saves it', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({
      ...optionalItem,
      customPrice: 150,
    });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.selectOptions(within(row).getByLabelText('Pricing mode'), 'custom');
    await userEvent.type(within(row).getByLabelText('Custom price'), '150');
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ pricingMode: 'custom', customPrice: 150 })
      )
    );
  });

  it('switches to discount pricing, reveals the percent input, and saves it', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({
      ...optionalItem,
      discountPercent: 15,
    });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.selectOptions(within(row).getByLabelText('Pricing mode'), 'discount');
    await userEvent.type(within(row).getByLabelText('Discount percent'), '15');
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ pricingMode: 'discount', discountPercent: 15 })
      )
    );
  });

  it('toggles featured and saves', async () => {
    vi.mocked(resellerCatalogApi.listCatalog).mockResolvedValueOnce([optionalItem]);
    vi.mocked(resellerCatalogApi.updateCatalogItem).mockResolvedValueOnce({
      ...optionalItem,
      isFeatured: true,
    });
    renderPage();

    const row = (await screen.findByText('Optional Tool')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Featured' }));
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(resellerCatalogApi.updateCatalogItem).toHaveBeenCalledWith(
        'rp-2',
        expect.objectContaining({ isFeatured: true })
      )
    );
  });
});
