import { User, UserDocument } from '../../models/User';
import { Tenant } from '../../models/Tenant';
import { EmailVerificationToken } from '../../models/EmailVerificationToken';
import { hashPassword } from '../../common/password';
import { generateOpaqueToken, hashToken } from '../../common/token';
import { NotFoundError, ConflictError } from '../../common/errors';
import { consoleEmailService } from '../../common/email';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export async function register(input: {
  tenantSubdomain: string;
  email: string;
  password: string;
}): Promise<{ user: UserDocument }> {
  const tenant = await Tenant.findOne({ subdomain: input.tenantSubdomain.toLowerCase() });
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ tenantId: tenant._id, email });
  if (existing) {
    throw new ConflictError('Email already registered for this tenant');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    tenantId: tenant._id,
    role: 'customer',
    email,
    passwordHash,
    status: 'pending',
  });
  const rawVerify = generateOpaqueToken();
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(rawVerify),
    expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    used: false,
  });
  await consoleEmailService.sendEmail(user.email, 'verify-email', { token: rawVerify });
  return { user };
}
