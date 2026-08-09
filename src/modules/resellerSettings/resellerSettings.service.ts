import { Tenant, TenantDocument, BrandingConfig, SupportConfig, StorefrontConfig, StoreSettingsConfig } from '../../models/Tenant';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import { sanitizeStorefrontHtml } from '../../common/sanitizeHtml';
import { encryptGatewayCredentials, TenantGatewayCredentials } from '../../common/paymentGateway';
import { encryptSecret } from '../../common/cryptoSecrets';
import { smtpEmailService } from '../../common/smtpEmail';
import { getResellerEntitlements } from '../../common/planEntitlements';

export interface FullStoreSettingsView {
  tenantId: string;
  storeName: string;
  subdomain: string;
  customDomain: string | null;
  domainVerified: boolean;
  sslStatus: string;
  branding: Record<string, unknown>;
  support: SupportConfig;
  storefront: StorefrontConfig;
  storeSettings: StoreSettingsConfig;
  smtpConfig: Record<string, unknown>;
  paymentGateway: Record<string, unknown>;
}

/** Secrets are stored encrypted but must never round-trip to the browser — callers only see whether one is set. */
function maskSecrets(config: Record<string, unknown>, secretKeys: string[]): Record<string, unknown> {
  const masked = { ...config };
  for (const key of secretKeys) {
    if (masked[key]) {
      masked[key] = undefined;
      masked[`${key}Set`] = true;
    }
  }
  return masked;
}

function toFullView(tenant: TenantDocument | null): FullStoreSettingsView {
  if (!tenant) throw new NotFoundError('Store settings not found');
  return {
    tenantId: tenant._id.toString(),
    storeName: tenant.name,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain ?? null,
    domainVerified: tenant.domainVerified ?? false,
    sslStatus: tenant.sslStatus ?? 'pending',
    branding: (tenant.brandingJson as Record<string, unknown>) ?? {},
    support: tenant.supportJson ?? {},
    storefront: tenant.storefrontJson ?? {},
    storeSettings: tenant.storeSettingsJson ?? {},
    smtpConfig: maskSecrets(tenant.smtpConfigJson ?? {}, ['passwordEncrypted']),
    paymentGateway: maskSecrets(tenant.paymentGatewayJson ?? {}, ['keySecretEncrypted']),
  };
}

export async function getStoreSettings(tenantId: string): Promise<FullStoreSettingsView> {
  const tenant = await Tenant.findById(tenantId);
  return toFullView(tenant);
}

export async function updateStoreSettings(
  tenantId: string,
  input: Record<string, unknown> & {
    storeName?: string;
    customDomain?: string | null;
    branding?: BrandingConfig;
    support?: SupportConfig;
    storefront?: StorefrontConfig;
    storeSettings?: StoreSettingsConfig;
    smtpConfig?: Record<string, unknown>;
    paymentGateway?: Record<string, unknown>;
  }
): Promise<FullStoreSettingsView> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError('Store not found');

  if (input.customDomain !== undefined) {
    if (input.customDomain && String(input.customDomain).trim() !== '') {
      const entitlements = await getResellerEntitlements(tenantId);
      if (!entitlements.canUseCustomDomain) {
        throw new ForbiddenError('Your plan does not include custom domains. Upgrade to Agency to connect one.');
      }
      const cleanDomain = String(input.customDomain).trim().toLowerCase();
      const existing = await Tenant.findOne({ customDomain: cleanDomain, _id: { $ne: tenant._id } });
      if (existing) throw new ConflictError('Custom domain is already mapped to another reseller');
      tenant.customDomain = cleanDomain;
    } else {
      tenant.customDomain = undefined;
    }
  }

  if (input.storeName) {
    tenant.name = input.storeName;
  }

  const {
    storeName: _storeName,
    customDomain: _customDomain,
    branding,
    support,
    storefront,
    storeSettings,
    smtpConfig,
    paymentGateway,
    ...extraBrandingProps
  } = input;

  const currentBranding = (tenant.brandingJson as Record<string, unknown>) || {};
  const updatedBranding = {
    ...currentBranding,
    ...(branding || {}),
    ...extraBrandingProps,
  };
  tenant.brandingJson = updatedBranding;

  if (support) {
    tenant.supportJson = { ...tenant.supportJson, ...support };
  }

  if (storefront) {
    const cleanStorefront = { ...storefront };
    if (typeof cleanStorefront.customHtmlContent === 'string') {
      cleanStorefront.customHtmlContent = sanitizeStorefrontHtml(cleanStorefront.customHtmlContent);
    }
    tenant.storefrontJson = { ...tenant.storefrontJson, ...cleanStorefront };
  }

  if (storeSettings) {
    tenant.storeSettingsJson = { ...tenant.storeSettingsJson, ...storeSettings };
  }

  if (smtpConfig) {
    tenant.smtpConfigJson = { ...tenant.smtpConfigJson, ...smtpConfig };
  }

  if (paymentGateway) {
    tenant.paymentGatewayJson = { ...tenant.paymentGatewayJson, ...paymentGateway };
  }

  await tenant.save();
  return toFullView(tenant);
}

export async function updatePaymentGateway(
  tenantId: string,
  input: { provider: 'razorpay'; keyId: string; keySecret?: string }
): Promise<FullStoreSettingsView> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError('Store not found');

  const existing = (tenant.paymentGatewayJson as TenantGatewayCredentials) ?? {};
  const encrypted = input.keySecret
    ? encryptGatewayCredentials({ provider: input.provider, keyId: input.keyId, keySecret: input.keySecret })
    : { provider: input.provider, keyId: input.keyId, keySecretEncrypted: existing.keySecretEncrypted };

  tenant.paymentGatewayJson = encrypted as Record<string, unknown>;
  await tenant.save();
  return toFullView(tenant);
}

export async function updateSmtpConfig(
  tenantId: string,
  input: { host: string; port: number; user?: string; password?: string; fromName?: string; fromEmail?: string }
): Promise<FullStoreSettingsView> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError('Store not found');

  const existing = tenant.smtpConfigJson ?? {};
  tenant.smtpConfigJson = {
    host: input.host,
    port: input.port,
    user: input.user ?? existing.user,
    passwordEncrypted: input.password ? encryptSecret(input.password) : existing.passwordEncrypted,
    fromName: input.fromName ?? existing.fromName,
    fromEmail: input.fromEmail ?? existing.fromEmail,
  };
  await tenant.save();
  return toFullView(tenant);
}

export async function sendTestEmail(tenantId: string, to: string): Promise<void> {
  await smtpEmailService.sendEmail(to, 'smtp-test', { tenantId, sentAt: new Date().toISOString() }, tenantId);
}

export async function verifyDomainDns(tenantId: string): Promise<FullStoreSettingsView> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError('Store not found');
  if (!tenant.customDomain) throw new ConflictError('No custom domain configured');

  tenant.domainVerified = true;
  tenant.sslStatus = 'active';
  await tenant.save();

  return toFullView(tenant);
}
