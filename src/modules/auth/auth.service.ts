import { Types } from 'mongoose';
import { User, UserDocument } from '../../models/User';
import { Tenant } from '../../models/Tenant';
import { EmailVerificationToken } from '../../models/EmailVerificationToken';
import { PasswordResetToken } from '../../models/PasswordResetToken';
import { RefreshToken } from '../../models/RefreshToken';
import { hashPassword, comparePassword } from '../../common/password';
import { generateOpaqueToken, hashToken } from '../../common/token';
import { signAccessToken } from '../../common/jwt';
import { NotFoundError, ConflictError, UnauthorizedError } from '../../common/errors';
import { consoleEmailService } from '../../common/email';
import { env } from '../../config/env';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

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

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(user: UserDocument): Promise<TokenPair> {
  const accessToken = signAccessToken({
    sub: (user._id as Types.ObjectId).toString(),
    role: user.role,
    tenantId: user.tenantId ? user.tenantId.toString() : null,
  });
  const rawRefresh = generateOpaqueToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(rawRefresh),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    revoked: false,
  });
  return { accessToken, refreshToken: rawRefresh };
}

export async function login(input: {
  email: string;
  password: string;
  tenantSubdomain?: string;
}): Promise<{ user: UserDocument; tokens: TokenPair }> {
  const query: Record<string, unknown> = { email: input.email.toLowerCase() };
  if (input.tenantSubdomain) {
    const tenant = await Tenant.findOne({ subdomain: input.tenantSubdomain.toLowerCase() });
    if (!tenant) throw new UnauthorizedError('Invalid credentials');
    query.tenantId = tenant._id;
  } else {
    query.tenantId = null;
  }
  const user = await User.findOne(query);
  if (!user) throw new UnauthorizedError('Invalid credentials');
  if (user.status === 'suspended') throw new UnauthorizedError('Account suspended');
  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');
  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function refresh(rawRefreshToken: string): Promise<TokenPair> {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  stored.revoked = true;
  await stored.save();
  const user = await User.findById(stored.userId);
  if (!user) throw new UnauthorizedError('Invalid refresh token');
  return issueTokenPair(user);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash }, { revoked: true });
}

export async function forgotPassword(input: { email: string; tenantSubdomain: string }): Promise<void> {
  const tenant = await Tenant.findOne({ subdomain: input.tenantSubdomain.toLowerCase() });
  if (!tenant) return;
  const user = await User.findOne({ tenantId: tenant._id, email: input.email.toLowerCase() });
  if (!user) return;
  const rawToken = generateOpaqueToken();
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
    used: false,
  });
  await consoleEmailService.sendEmail(user.email, 'reset-password', { token: rawToken });
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  const tokenHash = hashToken(input.token);
  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }
  const user = await User.findById(record.userId);
  if (!user) throw new NotFoundError('User not found');
  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();
  record.used = true;
  await record.save();
}
