import { Subscription } from '../../models/Subscription';
import { PlanDocument } from '../../models/Plan';
import { ResellerProduct } from '../../models/ResellerProduct';
import { Order } from '../../models/Order';
import { ProductDocument } from '../../models/Product';
import { UserDocument } from '../../models/User';

export interface ResellerSubscriptionView {
  _id: string;
  status: string;
  currentPeriodEnd: Date | null;
  daysRemaining: number | null;
  licenseKey: string | null;
  plan: { _id: string; name: string; price: number; currency: string; billingCycle: string } | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days left in the current period. Never negative — a lapsed plan reads as zero. */
function daysUntil(periodEnd: Date | null): number | null {
  if (!periodEnd) return null;
  const diff = periodEnd.getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / MS_PER_DAY);
}

export async function getSubscriptionForTenant(tenantId: string): Promise<ResellerSubscriptionView | null> {
  const subscription = await Subscription.findOne({ tenantId })
    .sort({ createdAt: -1 })
    .populate<{ planId: PlanDocument }>('planId');

  if (!subscription) return null;

  return {
    _id: subscription._id.toString(),
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    daysRemaining: daysUntil(subscription.currentPeriodEnd),
    licenseKey: subscription.licenseKey,
    plan: subscription.planId
      ? {
          _id: subscription.planId._id.toString(),
          name: subscription.planId.name,
          price: subscription.planId.price,
          currency: subscription.planId.currency,
          billingCycle: subscription.planId.billingCycle,
        }
      : null,
  };
}

export interface ResellerStats {
  catalogTotal: number;
  catalogLive: number;
  ordersTotal: number;
  ordersPaid: number;
  revenue: number;
  customers: number;
}

export async function getStatsForTenant(tenantId: string): Promise<ResellerStats> {
  const [catalogTotal, catalogLive, ordersTotal, paidOrders, customers] = await Promise.all([
    ResellerProduct.countDocuments({ tenantId }),
    ResellerProduct.countDocuments({ tenantId, enabled: true }),
    Order.countDocuments({ tenantId }),
    Order.find({ tenantId, status: 'paid' }).select('amount'),
    Order.distinct('customerUserId', { tenantId }),
  ]);

  // Revenue counts settled orders only; pending and failed ones are not money.
  const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  return {
    catalogTotal,
    catalogLive,
    ordersTotal,
    ordersPaid: paidOrders.length,
    revenue: Number(revenue.toFixed(2)),
    customers: customers.length,
  };
}

export interface ResellerOrderView {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  product: { _id: string; name: string; type: string } | null;
  customerEmail: string | null;
}

export async function listOrdersForTenant(tenantId: string): Promise<ResellerOrderView[]> {
  const orders = await Order.find({ tenantId })
    .sort({ createdAt: -1 })
    .populate<{ productId: ProductDocument }>('productId')
    .populate<{ customerUserId: UserDocument }>('customerUserId');

  return orders.map((order) => ({
    _id: order._id.toString(),
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt,
    product: order.productId
      ? {
          _id: order.productId._id.toString(),
          name: order.productId.name,
          type: order.productId.type,
        }
      : null,
    customerEmail: order.customerUserId ? order.customerUserId.email : null,
  }));
}
