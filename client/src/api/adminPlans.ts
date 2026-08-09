import { api } from '../lib/api';

export interface AdminPlan {
  _id: string;
  scope: 'reseller' | 'customer';
  name: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'annual' | 'lifetime';
  status: 'active' | 'archived';
  featureFlagsJson: Record<string, unknown>;
  limitsJson: Record<string, unknown>;
  createdAt: string;
}

export async function listAdminPlans(): Promise<AdminPlan[]> {
  const res = await api.get<{ plans: AdminPlan[] }>('/admin/plans');
  return res.data.plans;
}

export interface CreatePlanInput {
  scope: 'reseller' | 'customer';
  name: string;
  price: number;
  currency?: string;
  billingCycle: 'monthly' | 'annual' | 'lifetime';
}

export async function createAdminPlan(input: CreatePlanInput): Promise<AdminPlan> {
  const res = await api.post<{ plan: AdminPlan }>('/admin/plans', input);
  return res.data.plan;
}

export interface UpdatePlanInput {
  name?: string;
  price?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'annual' | 'lifetime';
}

export async function updateAdminPlan(id: string, input: UpdatePlanInput): Promise<AdminPlan> {
  const res = await api.patch<{ plan: AdminPlan }>(`/admin/plans/${id}`, input);
  return res.data.plan;
}

export async function archiveAdminPlan(id: string): Promise<AdminPlan> {
  const res = await api.delete<{ plan: AdminPlan }>(`/admin/plans/${id}`);
  return res.data.plan;
}
