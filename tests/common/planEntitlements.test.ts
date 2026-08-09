import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { getResellerEntitlements, seedDefaultResellerPlans, STARTER_FLAGS, PREMIUM_FLAGS, AGENCY_FLAGS } from '../../src/common/planEntitlements';
import { Tenant } from '../../src/models/Tenant';
import { Plan } from '../../src/models/Plan';
import { Subscription } from '../../src/models/Subscription';

beforeAll(async () => {
  const uri = await startTestDb();
  await mongoose.connect(uri);
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe('getResellerEntitlements', () => {
  it('falls back to restrictive Starter-shaped defaults when there is no active subscription', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-1' });
    const entitlements = await getResellerEntitlements(tenant._id.toString());

    expect(entitlements.canAddOwnProducts).toBe(false);
    expect(entitlements.canUseCustomDomain).toBe(false);
    expect(entitlements.canBuyFromMarketplace).toBe(false);
    expect(entitlements.planName).toBeNull();
  });

  it('resolves Starter plan flags for an active Starter subscription', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-2' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Starter',
      price: 999,
      billingCycle: 'monthly',
      featureFlagsJson: STARTER_FLAGS,
    });
    await Subscription.create({ tenantId: tenant._id, planId: plan._id, status: 'active' });

    const entitlements = await getResellerEntitlements(tenant._id.toString());
    expect(entitlements.canAddOwnProducts).toBe(false);
    expect(entitlements.canUseCustomDomain).toBe(false);
    expect(entitlements.canUseSubdomain).toBe(true);
    expect(entitlements.planName).toBe('Starter');
  });

  it('resolves Premium plan flags: catalog management + own products + subdomain, no custom domain', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-3' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Premium',
      price: 2999,
      billingCycle: 'monthly',
      featureFlagsJson: PREMIUM_FLAGS,
      limitsJson: { maxOwnProducts: 25 },
    });
    await Subscription.create({ tenantId: tenant._id, planId: plan._id, status: 'active' });

    const entitlements = await getResellerEntitlements(tenant._id.toString());
    expect(entitlements.canManageCatalog).toBe(true);
    expect(entitlements.canAddOwnProducts).toBe(true);
    expect(entitlements.canBuyFromMarketplace).toBe(true);
    expect(entitlements.canUseCustomDomain).toBe(false);
    expect(entitlements.maxOwnProducts).toBe(25);
  });

  it('resolves Agency plan flags: everything including custom domain and white-label', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-4' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Agency',
      price: 6999,
      billingCycle: 'monthly',
      featureFlagsJson: AGENCY_FLAGS,
    });
    await Subscription.create({ tenantId: tenant._id, planId: plan._id, status: 'active' });

    const entitlements = await getResellerEntitlements(tenant._id.toString());
    expect(entitlements.canUseCustomDomain).toBe(true);
    expect(entitlements.whiteLabel).toBe(true);
    expect(entitlements.canAddOwnProducts).toBe(true);
  });

  it('honors a grace-period subscription the same as active', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-5' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Agency',
      price: 6999,
      billingCycle: 'monthly',
      featureFlagsJson: AGENCY_FLAGS,
    });
    await Subscription.create({ tenantId: tenant._id, planId: plan._id, status: 'grace' });

    const entitlements = await getResellerEntitlements(tenant._id.toString());
    expect(entitlements.canUseCustomDomain).toBe(true);
  });

  it('falls back to defaults for an expired/cancelled subscription', async () => {
    const tenant = await Tenant.create({ name: 'Acme', subdomain: 'acme-ent-6' });
    const plan = await Plan.create({
      scope: 'reseller',
      name: 'Agency',
      price: 6999,
      billingCycle: 'monthly',
      featureFlagsJson: AGENCY_FLAGS,
    });
    await Subscription.create({ tenantId: tenant._id, planId: plan._id, status: 'expired' });

    const entitlements = await getResellerEntitlements(tenant._id.toString());
    expect(entitlements.canUseCustomDomain).toBe(false);
  });
});

describe('seedDefaultResellerPlans', () => {
  it('creates Starter/Premium/Agency plans idempotently', async () => {
    await seedDefaultResellerPlans();
    await seedDefaultResellerPlans();

    const plans = await Plan.find({ scope: 'reseller' });
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.name).sort()).toEqual(['Agency', 'Premium', 'Starter']);
  });
});
