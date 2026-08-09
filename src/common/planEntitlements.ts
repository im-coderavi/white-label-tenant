import { Subscription } from '../models/Subscription';
import { Plan, PlanDocument } from '../models/Plan';

/**
 * The three standard reseller tiers this platform ships with (Starter/Premium/Agency), matching
 * the competitor's plan structure: Starter = curated catalog only, no custom domain, no adding
 * products; Premium = adds subdomain-based store + ability to add own products; Agency = adds
 * custom domain + white-label rights.
 */
export interface PlanFeatureFlags {
  /** Reseller can enable/disable master-catalog products themselves (vs. admin assigning every one manually). */
  canManageCatalog?: boolean;
  /** Reseller can create their own products under "My Products", independent of the master catalog. */
  canAddOwnProducts?: boolean;
  /** Reseller can buy/unlock extra master-catalog products via the Marketplace beyond what's admin-assigned. */
  canBuyFromMarketplace?: boolean;
  /** Reseller can connect a custom domain (vs. subdomain only). */
  canUseCustomDomain?: boolean;
  /** Reseller can configure their own subdomain-based storefront at all. */
  canUseSubdomain?: boolean;
  /** Reseller can configure their own SMTP sender identity. */
  canConfigureSmtp?: boolean;
  /** Reseller can configure their own payment gateway credentials. */
  canConfigurePaymentGateway?: boolean;
  /** Fully white-labeled — no ToolzyPro branding anywhere on the storefront. */
  whiteLabel?: boolean;
}

export interface PlanLimits {
  /** Max own products the reseller can create under "My Products". 0 or omitted = not allowed (see canAddOwnProducts). */
  maxOwnProducts?: number;
  /** Max access codes the reseller can issue. Omitted = unlimited. */
  maxAccessCodes?: number;
}

export const STARTER_FLAGS: PlanFeatureFlags = {
  canManageCatalog: false,
  canAddOwnProducts: false,
  canBuyFromMarketplace: false,
  canUseCustomDomain: false,
  canUseSubdomain: true,
  canConfigureSmtp: false,
  canConfigurePaymentGateway: false,
  whiteLabel: false,
};

export const PREMIUM_FLAGS: PlanFeatureFlags = {
  canManageCatalog: true,
  canAddOwnProducts: true,
  canBuyFromMarketplace: true,
  canUseCustomDomain: false,
  canUseSubdomain: true,
  canConfigureSmtp: true,
  canConfigurePaymentGateway: true,
  whiteLabel: false,
};

export const AGENCY_FLAGS: PlanFeatureFlags = {
  canManageCatalog: true,
  canAddOwnProducts: true,
  canBuyFromMarketplace: true,
  canUseCustomDomain: true,
  canUseSubdomain: true,
  canConfigureSmtp: true,
  canConfigurePaymentGateway: true,
  whiteLabel: true,
};

/** Resolved view handed to gating checks — always has every flag defined (falls back to Starter's restrictive defaults). */
export type ResolvedEntitlements = Required<PlanFeatureFlags> & PlanLimits & { planName: string | null };

const DEFAULT_ENTITLEMENTS: ResolvedEntitlements = {
  ...(STARTER_FLAGS as Required<PlanFeatureFlags>),
  planName: null,
};

function mergeFlags(plan: PlanDocument): ResolvedEntitlements {
  const flags = (plan.featureFlagsJson as PlanFeatureFlags) ?? {};
  const limits = (plan.limitsJson as PlanLimits) ?? {};
  return {
    canManageCatalog: flags.canManageCatalog ?? false,
    canAddOwnProducts: flags.canAddOwnProducts ?? false,
    canBuyFromMarketplace: flags.canBuyFromMarketplace ?? false,
    canUseCustomDomain: flags.canUseCustomDomain ?? false,
    canUseSubdomain: flags.canUseSubdomain ?? true,
    canConfigureSmtp: flags.canConfigureSmtp ?? false,
    canConfigurePaymentGateway: flags.canConfigurePaymentGateway ?? false,
    whiteLabel: flags.whiteLabel ?? false,
    maxOwnProducts: limits.maxOwnProducts,
    maxAccessCodes: limits.maxAccessCodes,
    planName: plan.name,
  };
}

/**
 * Resolves what a reseller tenant is currently entitled to, from their active subscription's
 * plan. No active/grace subscription (lapsed, cancelled, or never subscribed) falls back to the
 * most restrictive defaults — same shape as Starter — so gated actions fail closed, not open.
 */
export async function getResellerEntitlements(tenantId: string): Promise<ResolvedEntitlements> {
  const subscription = await Subscription.findOne({ tenantId, status: { $in: ['active', 'grace'] } })
    .sort({ createdAt: -1 })
    .populate<{ planId: PlanDocument }>('planId');

  if (!subscription || !subscription.planId) {
    return DEFAULT_ENTITLEMENTS;
  }

  return mergeFlags(subscription.planId);
}

export async function seedDefaultResellerPlans(): Promise<void> {
  const defs: Array<{ name: string; price: number; billingCycle: 'monthly' | 'annual' | 'lifetime'; flags: PlanFeatureFlags; limits: PlanLimits }> = [
    { name: 'Starter', price: 999, billingCycle: 'monthly', flags: STARTER_FLAGS, limits: { maxOwnProducts: 0 } },
    { name: 'Premium', price: 2999, billingCycle: 'monthly', flags: PREMIUM_FLAGS, limits: { maxOwnProducts: 25 } },
    { name: 'Agency', price: 6999, billingCycle: 'monthly', flags: AGENCY_FLAGS, limits: {} },
  ];

  for (const def of defs) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await Plan.findOne({ scope: 'reseller', name: def.name });
    if (existing) {
      existing.featureFlagsJson = def.flags as Record<string, unknown>;
      existing.limitsJson = def.limits as Record<string, unknown>;
      // eslint-disable-next-line no-await-in-loop
      await existing.save();
    } else {
      // eslint-disable-next-line no-await-in-loop
      await Plan.create({
        scope: 'reseller',
        name: def.name,
        price: def.price,
        billingCycle: def.billingCycle,
        featureFlagsJson: def.flags,
        limitsJson: def.limits,
      });
    }
  }
}
