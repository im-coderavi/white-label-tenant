import { api } from '../lib/api';

export interface ResellerBranding {
  tenantId: string;
  storeName: string;
  subdomain: string;
  customDomain: string | null;
  branding: {
    tagline?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    accentColor?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    supportEmail?: string | null;
    whatsappUrl?: string | null;
  };
}

export async function getBranding(): Promise<ResellerBranding> {
  const res = await api.get<{ store: ResellerBranding }>('/reseller/branding');
  return res.data.store;
}

export async function updateBranding(input: {
  storeName?: string;
  tagline?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  supportEmail?: string | null;
  whatsappUrl?: string | null;
  customDomain?: string | null;
}): Promise<ResellerBranding> {
  const res = await api.patch<{ store: ResellerBranding }>('/reseller/branding', input);
  return res.data.store;
}

export interface PaymentGatewaySettings {
  provider?: 'razorpay';
  keyId?: string;
  keySecretEncryptedSet?: boolean;
}

export interface SmtpSettings {
  host?: string;
  port?: number;
  user?: string;
  fromName?: string;
  fromEmail?: string;
  passwordEncryptedSet?: boolean;
}

export async function getStoreSettings(): Promise<{
  paymentGateway: PaymentGatewaySettings;
  smtpConfig: SmtpSettings;
}> {
  const res = await api.get<{ store: { paymentGateway: PaymentGatewaySettings; smtpConfig: SmtpSettings } }>(
    '/reseller/settings'
  );
  return res.data.store;
}

export async function updatePaymentGateway(input: {
  provider: 'razorpay';
  keyId: string;
  keySecret?: string;
}): Promise<PaymentGatewaySettings> {
  const res = await api.patch<{ store: { paymentGateway: PaymentGatewaySettings } }>(
    '/reseller/payment-gateway',
    input
  );
  return res.data.store.paymentGateway;
}

export async function updateSmtpConfig(input: {
  host: string;
  port: number;
  user?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
}): Promise<SmtpSettings> {
  const res = await api.patch<{ store: { smtpConfig: SmtpSettings } }>('/reseller/smtp', input);
  return res.data.store.smtpConfig;
}

export async function sendTestEmail(to: string): Promise<void> {
  await api.post('/reseller/smtp/test', { to });
}
