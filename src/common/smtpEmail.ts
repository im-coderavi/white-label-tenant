import nodemailer, { Transporter } from 'nodemailer';
import { EmailService } from './email';
import { env } from './../config/env';
import { Tenant } from '../models/Tenant';
import { decryptSecret, isEncryptedSecret } from './cryptoSecrets';
import { renderEmail } from './emailTemplates';
import { logger } from './logger';

const globalTransporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

export interface ResolvedTenantSmtp {
  transporter: Transporter;
  fromAddress: string;
  siteName: string;
  logoUrl?: string;
  primaryColor: string;
}

interface StoredSmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  passwordEncrypted?: string;
  fromName?: string;
  fromEmail?: string;
}

/** Reads the tenant's own SMTP creds + branding if configured, decrypting the password; returns null to signal "use the platform default transport". */
export async function resolveTenantSmtp(tenantId: string | null | undefined): Promise<ResolvedTenantSmtp | null> {
  if (!tenantId) return null;
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return null;

  const branding = (tenant.brandingJson as { siteName?: string; logoUrl?: string; themeColor?: string }) ?? {};
  const config = tenant.smtpConfigJson as StoredSmtpConfig | undefined;

  if (!config?.host || !config.port) return null;

  let password: string | undefined;
  if (config.passwordEncrypted) {
    try {
      password = isEncryptedSecret(config.passwordEncrypted)
        ? decryptSecret(config.passwordEncrypted)
        : config.passwordEncrypted;
    } catch (err) {
      logger.error('Failed to decrypt tenant SMTP password, falling back to platform SMTP', {
        tenantId,
        error: err instanceof Error ? err.stack : err,
      });
      return null;
    }
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user && password ? { user: config.user, pass: password } : undefined,
  });

  return {
    transporter,
    fromAddress: config.fromEmail ?? env.SMTP_FROM,
    siteName: tenant.name ?? branding.siteName ?? 'ToolzyPro',
    logoUrl: branding.logoUrl,
    primaryColor: branding.themeColor ?? '#0F766E',
  };
}

export const smtpEmailService: EmailService = {
  async sendEmail(to, template, data, tenantId) {
    const tenantSmtp = await resolveTenantSmtp(tenantId);
    const rendered = renderEmail(template, data, tenantSmtp ?? undefined);

    const transporter = tenantSmtp?.transporter ?? globalTransporter;
    const from = tenantSmtp
      ? `${tenantSmtp.siteName} <${tenantSmtp.fromAddress}>`
      : env.SMTP_FROM;

    await transporter.sendMail({
      from,
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  },
};
