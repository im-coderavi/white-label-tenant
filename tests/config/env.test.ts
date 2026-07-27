jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('env validation', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('parses successfully with all required vars set', () => {
    expect(() => require('../../src/config/env')).not.toThrow();
  });

  it('throws when CLOUDINARY_URL is missing', () => {
    delete process.env.CLOUDINARY_URL;
    expect(() => require('../../src/config/env')).toThrow();
  });

  it('throws when SMTP_HOST is missing', () => {
    delete process.env.SMTP_HOST;
    expect(() => require('../../src/config/env')).toThrow();
  });

  it('coerces SMTP_PORT to a number', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { env } = require('../../src/config/env');
    expect(env.SMTP_PORT).toBe(587);
    expect(typeof env.SMTP_PORT).toBe('number');
  });
});
