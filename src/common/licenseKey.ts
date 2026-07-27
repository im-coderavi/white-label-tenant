import crypto from 'crypto';

const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateLicenseKey(): string {
  const year = new Date().getFullYear();
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += KEY_CHARS[crypto.randomInt(KEY_CHARS.length)];
  }
  return `TZP-${year}-${suffix}`;
}
