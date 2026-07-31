import { Tenant } from '../../models/Tenant';
import { User } from '../../models/User';
import { Plan } from '../../models/Plan';
import { Subscription } from '../../models/Subscription';
import { ConflictError, NotFoundError } from '../../common/errors';
import { hashPassword } from '../../common/password';
import { mockPaymentGateway } from '../../common/paymentGateway';

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
