import { Tenant } from '../../models/Tenant';
import { User } from '../../models/User';
import { Plan } from '../../models/Plan';
import { Subscription, SubscriptionDocument } from '../../models/Subscription';
import { ConflictError, NotFoundError } from '../../common/errors';
import { hashPassword } from '../../common/password';
import { mockPaymentGateway } from '../../common/paymentGateway';
import { generateSubscriptionKey } from '../../common/licenseKey';
import { smtpEmailService } from '../../common/smtpEmail';

export interface RegisterResellerResult {
  tenantId: string;
  userId: string;
  subscriptionId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export async function registerReseller(input: {
  businessName: string;
  subdomain: string;
  email: string;
  password: string;
  planId: string;
}): Promise<RegisterResellerResult> {
  const plan = await Plan.findById(input.planId);
  if (!plan || plan.status !== 'active' || plan.scope !== 'reseller') {
    throw new NotFoundError('Plan not found');
  }

  const subdomain = input.subdomain.toLowerCase();
  const existingTenant = await Tenant.findOne({ subdomain });
  if (existingTenant) {
    throw new ConflictError('Subdomain already in use');
  }

  const tenant = await Tenant.create({ name: input.businessName, subdomain, status: 'pending' });
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    tenantId: tenant._id,
    role: 'reseller_admin',
    email: input.email.toLowerCase(),
    passwordHash,
    status: 'pending',
  });
  const subscription = await Subscription.create({
    tenantId: tenant._id,
    planId: plan._id,
    status: 'pending',
  });

  const { gatewayOrderId } = await mockPaymentGateway.createOrder({
    amount: plan.price,
    currency: plan.currency,
    receipt: subscription._id.toString(),
  });
  subscription.paymentRef = gatewayOrderId;
  await subscription.save();

  return {
    tenantId: tenant._id.toString(),
    userId: user._id.toString(),
    subscriptionId: subscription._id.toString(),
    gatewayOrderId,
    amount: plan.price,
    currency: plan.currency,
  };
}

export async function processResellerSignupWebhook(
  gatewayOrderId: string,
  success: boolean
): Promise<SubscriptionDocument> {
  const subscription = await Subscription.findOne({ paymentRef: gatewayOrderId });
  if (!subscription) {
    throw new NotFoundError('Subscription not found for gateway reference');
  }

  if (!success) {
    subscription.status = 'cancelled';
    await subscription.save();
    return subscription;
  }

  const plan = await Plan.findById(subscription.planId);
  if (!plan) {
    throw new NotFoundError('Plan not found');
  }

  subscription.status = 'active';
  if (!subscription.licenseKey) {
    subscription.licenseKey = generateSubscriptionKey();
  }
  if (plan.billingCycle === 'lifetime') {
    subscription.currentPeriodEnd = null;
  } else {
    const periodEnd = new Date();
    if (plan.billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }
    subscription.currentPeriodEnd = periodEnd;
  }
  await subscription.save();

  await Tenant.findByIdAndUpdate(subscription.tenantId, { status: 'active' });
  const user = await User.findOneAndUpdate(
    { tenantId: subscription.tenantId, role: 'reseller_admin' },
    { status: 'active' },
    { new: true }
  );

  if (user) {
    await smtpEmailService.sendEmail(user.email, 'reseller-welcome', {
      tenantId: subscription.tenantId.toString(),
    });
  }

  return subscription;
}
