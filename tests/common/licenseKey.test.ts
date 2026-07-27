import { generateLicenseKey } from '../../src/common/licenseKey';

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
