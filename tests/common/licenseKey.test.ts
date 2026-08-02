import { generateLicenseKey, generateSubscriptionKey } from '../../src/common/licenseKey';

describe('generateLicenseKey', () => {
  it('matches the TZP-YYYY-XXXXXXXX format', () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^TZP-\d{4}-[A-Z0-9]{8}$/);
  });

  it('generates different keys on subsequent calls', () => {
    const a = generateLicenseKey();
    const b = generateLicenseKey();
    expect(a).not.toBe(b);
  });
});

describe('generateSubscriptionKey', () => {
  it('carries an RS marker so it is never mistaken for a product key', () => {
    const key = generateSubscriptionKey();
    expect(key).toMatch(/^TZP-RS-\d{4}-[A-Z0-9]{8}$/);
    expect(key).not.toMatch(/^TZP-\d{4}-/);
  });

  it('generates different keys on subsequent calls', () => {
    expect(generateSubscriptionKey()).not.toBe(generateSubscriptionKey());
  });
});
