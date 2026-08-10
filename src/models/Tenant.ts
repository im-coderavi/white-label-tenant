import { Schema, model, Document } from 'mongoose';

export type TenantPlan = 'starter' | 'premium' | 'enterprise';
export type TenantStatus = 'pending' | 'active' | 'suspended';

export interface BrandingConfig {
  siteName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeColor?: string;
  footerText?: string;
}

export interface SupportConfig {
  supportEmail?: string;
  whatsappNumber?: string;
  officeAddress?: string;
  jurisdiction?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    telegram?: string;
    linkedin?: string;
    whatsapp?: string;
  };
  trustpilotUrl?: string;
  trustpilotWidgetToken?: string;
  trustpilotBusinessUnitId?: string;
}

export interface StorefrontConfig {
  heroTitle?: string;
  heroSubtitle?: string;
  facebookPixelId?: string;
  landingTemplate?: 'professional' | 'modern_light' | 'dark_premium' | 'minimal' | 'video_story' | 'custom_html';
  customHtmlContent?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface StoreSettingsConfig {
  sellingMode?: 'subscriptions' | 'single' | 'both';
  defaultPrice?: number;
  defaultVisibility?: boolean;
  downloadLimit?: number;
  licenseExpiryDays?: number;
  requireLicenseForDownload?: boolean;
  enablePreviews?: boolean;
}

export interface TenantDocument extends Document {
  name: string;
  subdomain: string;
  customDomain?: string;
  domainVerified?: boolean;
  sslStatus?: 'pending' | 'active' | 'failed';
  plan: TenantPlan;
  status: TenantStatus;
  brandingJson: BrandingConfig;
  supportJson: SupportConfig;
  storefrontJson: StorefrontConfig;
  storeSettingsJson: StoreSettingsConfig;
  smtpConfigJson: Record<string, unknown>;
  paymentGatewayJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDocument>(
  {
    name: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customDomain: { type: String, unique: true, sparse: true },
    domainVerified: { type: Boolean, default: false },
    sslStatus: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending' },
    plan: { type: String, enum: ['starter', 'premium', 'enterprise'], default: 'starter' },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    brandingJson: { type: Schema.Types.Mixed, default: {} },
    supportJson: { type: Schema.Types.Mixed, default: {} },
    storefrontJson: { type: Schema.Types.Mixed, default: {} },
    storeSettingsJson: { type: Schema.Types.Mixed, default: {} },
    smtpConfigJson: { type: Schema.Types.Mixed, default: {} },
    paymentGatewayJson: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Tenant = model<TenantDocument>('Tenant', tenantSchema);

