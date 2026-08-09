import { api } from '../lib/api';

export interface AdminReseller {
  _id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  status: string;
  adminEmail: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  customers: number;
  revenue: number;
  createdAt: string;
}

export async function listAdminResellers(): Promise<AdminReseller[]> {
  const res = await api.get<{ resellers: AdminReseller[] }>('/admin/resellers');
  return res.data.resellers;
}

export async function suspendAdminReseller(id: string): Promise<AdminReseller> {
  const res = await api.patch<{ reseller: AdminReseller }>(`/admin/resellers/${id}/suspend`);
  return res.data.reseller;
}

export async function activateAdminReseller(id: string): Promise<AdminReseller> {
  const res = await api.patch<{ reseller: AdminReseller }>(`/admin/resellers/${id}/activate`);
  return res.data.reseller;
}

export async function getAdminReseller(id: string): Promise<AdminReseller> {
  const res = await api.get<{ reseller: AdminReseller }>(`/admin/resellers/${id}`);
  return res.data.reseller;
}

export async function assignResellerPlan(id: string, planId: string): Promise<AdminReseller> {
  const res = await api.patch<{ reseller: AdminReseller }>(`/admin/resellers/${id}/plan`, { planId });
  return res.data.reseller;
}

export interface ResellerEntitlement {
  _id: string;
  productId: string;
  productName: string;
  enabled: boolean;
}

export async function listResellerEntitlements(id: string): Promise<ResellerEntitlement[]> {
  const res = await api.get<{ entitlements: ResellerEntitlement[] }>(`/admin/resellers/${id}/entitlements`);
  return res.data.entitlements;
}

export async function setResellerEntitlement(
  id: string,
  productId: string,
  enabled: boolean
): Promise<ResellerEntitlement> {
  const res = await api.patch<{ entitlement: ResellerEntitlement }>(`/admin/resellers/${id}/entitlements`, {
    productId,
    enabled,
  });
  return res.data.entitlement;
}
