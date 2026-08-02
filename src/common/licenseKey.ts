import crypto from 'crypto';

const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomSuffix(): string {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += KEY_CHARS[crypto.randomInt(KEY_CHARS.length)];
  }
  return suffix;
}

/** Key handed to a customer for one purchased product. */
export function generateLicenseKey(): string {
  return `TZP-${new Date().getFullYear()}-${randomSuffix()}`;
}

/** Key that identifies a reseller's own subscription. The RS marker keeps the two apart. */
export function generateSubscriptionKey(): string {
  return `TZP-RS-${new Date().getFullYear()}-${randomSuffix()}`;
}
