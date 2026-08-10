import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StoreSettingsPage from './StoreSettingsPage';
import * as settingsApi from '../../api/resellerSettings';

vi.mock('../../api/resellerSettings', () => ({
  getBranding: vi.fn(),
  updateBranding: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StoreSettingsPage />
    </QueryClientProvider>
  );
}

describe('StoreSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getBranding).mockReset();
    vi.mocked(settingsApi.updateBranding).mockReset();
  });

  it('loads branding and saves white-label changes', async () => {
    vi.mocked(settingsApi.getBranding).mockResolvedValue({
      tenantId: 't1',
      storeName: 'Acme Store',
      subdomain: 'acme',
      customDomain: null,
      branding: { tagline: 'Best deals', primaryColor: '#0F766E', accentColor: '#F59E0B' },
    });
    vi.mocked(settingsApi.updateBranding).mockResolvedValue({
      tenantId: 't1',
      storeName: 'Acme Pro',
      subdomain: 'acme',
      customDomain: 'store.acme.test',
      branding: { tagline: 'Best deals', primaryColor: '#0F766E', accentColor: '#F59E0B' },
    });

    renderPage();

    const storeName = await screen.findByLabelText('Store name');
    await userEvent.clear(storeName);
    await userEvent.type(storeName, 'Acme Pro');
    await userEvent.type(screen.getByLabelText('Custom domain'), 'store.acme.test');
    await userEvent.click(screen.getByRole('button', { name: 'Save branding' }));

    await waitFor(() =>
      expect(settingsApi.updateBranding).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: 'Acme Pro', customDomain: 'store.acme.test' })
      )
    );
    expect(await screen.findByText('Store settings saved.')).toBeInTheDocument();
  });
});
