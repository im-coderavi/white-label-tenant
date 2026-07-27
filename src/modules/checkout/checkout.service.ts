import { Order, OrderDocument } from '../../models/Order';
import { Product } from '../../models/Product';
import { ResellerProduct } from '../../models/ResellerProduct';
import { ForbiddenError, NotFoundError } from '../../common/errors';
import { mockPaymentGateway } from '../../common/paymentGateway';

export interface CreateCheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
}

export async function createCheckout(input: {
  productId: string;
  tenantId: string;
  customerUserId: string;
}): Promise<CreateCheckoutResult> {
  const product = await Product.findById(input.productId);
  if (!product || product.status !== 'published') {
    throw new NotFoundError('Product not found');
  }
  const entitlement = await ResellerProduct.findOne({
    tenantId: input.tenantId,
    productId: product._id,
    enabled: true,
  });
  if (!entitlement) {
    throw new ForbiddenError('Product not available to your store');
  }

  const orderType = product.type === 'subscription' ? 'subscription' : 'single_product';
  const amount = entitlement.customPrice ?? product.basePrice;

  const order = await Order.create({
    tenantId: input.tenantId,
    customerUserId: input.customerUserId,
    productId: product._id,
    orderType,
    amount,
    currency: product.currency,
    status: 'pending',
    paymentGateway: 'mock',
  });

  const { gatewayOrderId } = await mockPaymentGateway.createOrder({
    amount,
    currency: product.currency,
    receipt: order._id.toString(),
  });
  order.paymentRef = gatewayOrderId;
  await order.save();

  return {
    orderId: (order._id as OrderDocument['_id']).toString(),
    gatewayOrderId,
    amount,
    currency: product.currency,
  };
}
