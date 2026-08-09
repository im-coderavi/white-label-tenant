import { api } from '../lib/api';

export interface ResellerEntitlements {
  canManageCatalog: boolean;
  canAddOwnProducts: boolean;
  canBuyFromMarketplace: boolean;
  canUseCustomDomain: boolean;
  canUseSubdomain: boolean;
  canConfigureSmtp: boolean;
  canConfigurePaymentGateway: boolean;
  whiteLabel: boolean;
  maxOwnProducts?: number;
  maxAccessCodes?: number;
  planName: string | null;
}

export async function getResellerEntitlements(): Promise<ResellerEntitlements> {
  const res = await api.get<{ entitlements: ResellerEntitlements }>('/reseller/entitlements');
  return res.data.entitlements;
}
