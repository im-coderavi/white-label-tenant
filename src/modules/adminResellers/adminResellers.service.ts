import { Types } from 'mongoose';
import { Tenant, TenantDocument } from '../../models/Tenant';
import { User } from '../../models/User';
import { Subscription } from '../../models/Subscription';
import { Plan } from '../../models/Plan';
import { Order } from '../../models/Order';
import { ResellerCustomer } from '../../models/ResellerCustomer';
import { ResellerProduct } from '../../models/ResellerProduct';
import { Product, ProductDocument } from '../../models/Product';
import { NotFoundError, ConflictError } from '../../common/errors';

export interface ResellerSummary {
  _id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  status: string;
  adminEmail: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  customers: number;
  revenue: number;
  createdAt: Date;
}

async function toSummary(tenant: TenantDocument): Promise<ResellerSummary> {
  const [admin, subscription, customers, revenue] = await Promise.all([
    User.findOne({ tenantId: tenant._id, role: 'reseller_admin' }),
    Subscription.findOne({ tenantId: tenant._id }).sort({ createdAt: -1 }).populate<{ planId: { name: string } }>('planId'),
    ResellerCustomer.countDocuments({ tenantId: tenant._id }),
    Order.aggregate<{ total: number }>([
      { $match: { tenantId: tenant._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    _id: tenant._id.toString(),
    name: tenant.name,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain ?? null,
    status: tenant.status,
    adminEmail: admin?.email ?? null,
    planName: subscription?.planId ? subscription.planId.name : null,
    subscriptionStatus: subscription?.status ?? null,
    customers,
    revenue: revenue[0]?.total ?? 0,
    createdAt: tenant.createdAt,
  };
}

export async function listResellers(): Promise<ResellerSummary[]> {
  const tenants = await Tenant.find().sort({ createdAt: -1 });
  return Promise.all(tenants.map((tenant) => toSummary(tenant)));
}

export async function getReseller(id: string): Promise<ResellerSummary> {
  const tenant = await Tenant.findById(id);
  if (!tenant) throw new NotFoundError('Reseller not found');
  return toSummary(tenant);
}

export async function setResellerStatus(id: string, status: 'active' | 'suspended'): Promise<ResellerSummary> {
  const tenant = await Tenant.findById(id);
  if (!tenant) throw new NotFoundError('Reseller not found');
  tenant.status = status;
  await tenant.save();
  await User.updateMany({ tenantId: tenant._id, role: { $in: ['reseller_admin', 'reseller_staff'] } }, { status });
  return toSummary(tenant);
}

/** Master admin directly assigns/changes a reseller's subscription plan — bypasses payment entirely (comp/manual assignment). */
export async function assignResellerPlan(tenantId: string, planId: string): Promise<ResellerSummary> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError('Reseller not found');
  const plan = await Plan.findOne({ _id: planId, scope: 'reseller' });
  if (!plan) throw new NotFoundError('Reseller plan not found');

  let subscription = await Subscription.findOne({ tenantId: tenant._id }).sort({ createdAt: -1 });
  const periodEnd = (): Date | null => {
    if (plan.billingCycle === 'lifetime') return null;
    const end = new Date();
    if (plan.billingCycle === 'monthly') end.setMonth(end.getMonth() + 1);
    else end.setFullYear(end.getFullYear() + 1);
    return end;
  };

  if (subscription) {
    subscription.planId = plan._id;
    subscription.status = 'active';
    subscription.currentPeriodEnd = periodEnd();
  } else {
    subscription = new Subscription({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'active',
      currentPeriodEnd: periodEnd(),
    });
  }
  await subscription.save();

  if (tenant.status === 'pending') {
    tenant.status = 'active';
    await tenant.save();
  }

  return toSummary(tenant);
}

export interface ResellerEntitlement {
  _id: string;
  productId: string;
  productName: string;
  enabled: boolean;
}

export async function listResellerEntitlements(tenantId: string): Promise<ResellerEntitlement[]> {
  const rows = await ResellerProduct.find({ tenantId }).populate<{ productId: ProductDocument }>('productId');
  return rows
    .filter((row) => Boolean(row.productId))
    .map((row) => ({
      _id: row._id.toString(),
      productId: row.productId._id.toString(),
      productName: row.productId.name,
      enabled: row.enabled,
    }));
}

/** Master admin directly grants (or revokes) a reseller's access to a master product, independent of its sync mode. */
export async function setResellerProductEntitlement(
  tenantId: string,
  productId: string,
  enabled: boolean
): Promise<ResellerEntitlement> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new NotFoundError('Reseller not found');
  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError('Product not found');
  if (product.syncMode === 'global' && !enabled) {
    throw new ConflictError('Global products cannot be disabled for an individual reseller');
  }

  const row = await ResellerProduct.findOneAndUpdate(
    { tenantId: new Types.ObjectId(tenantId), productId: new Types.ObjectId(productId) },
    { $set: { enabled }, $setOnInsert: { tenantId, productId } },
    { upsert: true, new: true }
  );

  return { _id: row._id.toString(), productId: product._id.toString(), productName: product.name, enabled: row.enabled };
}
