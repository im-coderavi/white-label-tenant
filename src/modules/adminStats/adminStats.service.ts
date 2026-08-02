import { Tenant } from '../../models/Tenant';
import { Product } from '../../models/Product';
import { Order } from '../../models/Order';
import { Subscription } from '../../models/Subscription';
import { License } from '../../models/License';

export interface PlatformStats {
  tenantsTotal: number;
  tenantsActive: number;
  productsTotal: number;
  productsPublished: number;
  subscriptionsActive: number;
  ordersPaid: number;
  revenue: number;
  /** Keys handed to a buyer — assigned or already activated. */
  licensesIssued: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [
    tenantsTotal,
    tenantsActive,
    productsTotal,
    productsPublished,
    subscriptionsActive,
    paidOrders,
    licensesIssued,
  ] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: 'active' }),
    Product.countDocuments(),
    Product.countDocuments({ status: 'published' }),
    Subscription.countDocuments({ status: 'active' }),
    Order.find({ status: 'paid' }).select('amount'),
    License.countDocuments({ status: { $in: ['assigned', 'activated'] } }),
  ]);

  const revenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  return {
    tenantsTotal,
    tenantsActive,
    productsTotal,
    productsPublished,
    subscriptionsActive,
    ordersPaid: paidOrders.length,
    revenue: Number(revenue.toFixed(2)),
    licensesIssued,
  };
}
