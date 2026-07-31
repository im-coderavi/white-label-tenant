import { Plan, PlanDocument, PlanBillingCycle } from '../../models/Plan';
import { NotFoundError } from '../../common/errors';

export async function listPlans(): Promise<PlanDocument[]> {
  return Plan.find().sort({ createdAt: -1 });
}

export async function createPlan(input: {
  scope: 'reseller' | 'customer';
  name: string;
  price: number;
  currency?: string;
  billingCycle: PlanBillingCycle;
  featureFlagsJson?: Record<string, unknown>;
  limitsJson?: Record<string, unknown>;
}): Promise<PlanDocument> {
  return Plan.create({
    scope: input.scope,
    name: input.name,
    price: input.price,
    currency: input.currency ?? 'INR',
    billingCycle: input.billingCycle,
    featureFlagsJson: input.featureFlagsJson ?? {},
    limitsJson: input.limitsJson ?? {},
  });
}

export async function getPlanById(id: string): Promise<PlanDocument> {
  const plan = await Plan.findById(id);
  if (!plan) throw new NotFoundError('Plan not found');
  return plan;
}

export async function updatePlan(
  id: string,
  input: {
    name?: string;
    price?: number;
    currency?: string;
    billingCycle?: PlanBillingCycle;
    featureFlagsJson?: Record<string, unknown>;
    limitsJson?: Record<string, unknown>;
  }
): Promise<PlanDocument> {
  const plan = await getPlanById(id);
  if (input.name !== undefined) plan.name = input.name;
  if (input.price !== undefined) plan.price = input.price;
  if (input.currency !== undefined) plan.currency = input.currency;
  if (input.billingCycle !== undefined) plan.billingCycle = input.billingCycle;
  if (input.featureFlagsJson !== undefined) plan.featureFlagsJson = input.featureFlagsJson;
  if (input.limitsJson !== undefined) plan.limitsJson = input.limitsJson;
  await plan.save();
  return plan;
}

export async function archivePlan(id: string): Promise<PlanDocument> {
  const plan = await getPlanById(id);
  plan.status = 'archived';
  await plan.save();
  return plan;
}

export async function listActiveResellerPlans(): Promise<PlanDocument[]> {
  return Plan.find({ status: 'active', scope: 'reseller' }).sort({ price: 1 });
}
