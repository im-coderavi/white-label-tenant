export interface EmailBranding {
  siteName: string;
  logoUrl?: string;
  primaryColor: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_BRANDING: EmailBranding = { siteName: 'ToolzyPro', primaryColor: '#0F766E' };

function shell(branding: EmailBranding, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${branding.primaryColor};padding:20px 28px;">
                ${
                  branding.logoUrl
                    ? `<img src="${branding.logoUrl}" alt="${branding.siteName}" height="28" />`
                    : `<span style="color:#ffffff;font-size:18px;font-weight:bold;">${branding.siteName}</span>`
                }
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#18181b;font-size:14px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">
                Sent by ${branding.siteName}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

type TemplateKey =
  | 'verify-email'
  | 'reset-password'
  | 'order-paid'
  | 'reseller-welcome'
  | 'license-issued'
  | 'smtp-test'
  | 'grant-access'
  | 'license-request-approved'
  | 'license-request-rejected'
  | 'support-ticket-reply';

const APP_URL_FALLBACK = 'https://toolzypro.in';

function renderers(): Record<TemplateKey, (data: Record<string, unknown>) => { subject: string; body: string }> {
  return {
    'verify-email': (data) => ({
      subject: 'Verify your email address',
      body: `<p>Welcome! Please verify your email to activate your account.</p>
        <p><a href="${APP_URL_FALLBACK}/verify-email?token=${data.token}" style="color:#0F766E;">Verify email</a></p>`,
    }),
    'reset-password': (data) => ({
      subject: 'Reset your password',
      body: `<p>We received a request to reset your password.</p>
        <p><a href="${APP_URL_FALLBACK}/reset-password?token=${data.token}" style="color:#0F766E;">Reset password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>`,
    }),
    'order-paid': (data) => ({
      subject: 'Your order is confirmed',
      body: `<p>Thanks for your purchase! Your order <strong>${data.orderId}</strong> has been confirmed.</p>
        <p>Your license and downloads are available in your account dashboard.</p>`,
    }),
    'reseller-welcome': () => ({
      subject: 'Your reseller store is live',
      body: `<p>Your subscription is active and your reseller store has been provisioned.</p>
        <p>Log in to your reseller panel to finish branding your storefront.</p>`,
    }),
    'license-issued': (data) => ({
      subject: 'Your license key',
      body: `<p>Here is your license key:</p>
        <p style="font-family:monospace;font-size:16px;background:#f4f4f5;padding:8px 12px;border-radius:4px;">${data.licenseKey}</p>`,
    }),
    'smtp-test': () => ({
      subject: 'SMTP test email',
      body: `<p>This is a test email confirming your SMTP configuration is working correctly.</p>`,
    }),
    'grant-access': (data) => ({
      subject: 'Product access granted',
      body: `<p>You've been granted access to <strong>${data.productName}</strong>.</p>
        ${data.licenseKey ? `<p style="font-family:monospace;font-size:16px;background:#f4f4f5;padding:8px 12px;border-radius:4px;">${data.licenseKey}</p>` : ''}`,
    }),
    'license-request-approved': (data) => ({
      subject: 'License request approved',
      body: `<p>Your license request for <strong>${data.productName}</strong> has been approved.</p>`,
    }),
    'license-request-rejected': (data) => ({
      subject: 'License request update',
      body: `<p>Your license request for <strong>${data.productName}</strong> was not approved.</p>
        ${data.notes ? `<p>Note: ${data.notes}</p>` : ''}`,
    }),
    'support-ticket-reply': (data) => ({
      subject: `Re: ${data.ticketSubject}`,
      body: `<p>There's a new reply on your support ticket "<strong>${data.ticketSubject}</strong>".</p>`,
    }),
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function renderEmail(
  template: string,
  data: Record<string, unknown>,
  branding: Partial<EmailBranding> = {}
): RenderedEmail {
  const merged = { ...DEFAULT_BRANDING, ...branding };
  const renderer = renderers()[template as TemplateKey];
  const { subject, body } = renderer ? renderer(data) : { subject: `Notification: ${template}`, body: `<pre>${JSON.stringify(data, null, 2)}</pre>` };
  const html = shell(merged, body);
  return { subject, html, text: stripHtml(body) };
}
