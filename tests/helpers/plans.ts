import { Types } from 'mongoose';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';
import { AGENCY_FLAGS } from '../../src/common/planEntitlements';

/** Gives a tenant an active Agency-tier subscription so plan-gated actions (custom domain, SMTP, gateway, marketplace) pass in tests that aren't specifically exercising the gate. */
export async function grantAgencyPlan(tenantId: string | Types.ObjectId): Promise<void> {
  const plan = await Plan.create({
    scope: 'reseller',
    name: `Agency-Test-${new Types.ObjectId().toString()}`,
    price: 6999,
    billingCycle: 'monthly',
    featureFlagsJson: AGENCY_FLAGS,
  });
  await Subscription.create({ tenantId, planId: plan._id, status: 'active' });
}
