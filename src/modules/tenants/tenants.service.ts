import { Tenant, TenantDocument } from '../../models/Tenant';
import { Product } from '../../models/Product';
import { ResellerProduct } from '../../models/ResellerProduct';
import { ConflictError, NotFoundError } from '../../common/errors';

export async function createTenant(input: { name: string; subdomain: string }): Promise<TenantDocument> {
  const subdomain = input.subdomain.toLowerCase();
  const existing = await Tenant.findOne({ subdomain });
  if (existing) {
    throw new ConflictError('Subdomain already in use');
  }
  const tenant = await Tenant.create({ name: input.name, subdomain, status: 'active' });

  const globalProducts = await Product.find({ syncMode: 'global' });
  await Promise.all(
    globalProducts.map((product) =>
      ResellerProduct.findOneAndUpdate(
        { tenantId: tenant._id, productId: product._id },
        { $set: { enabled: true }, $setOnInsert: { tenantId: tenant._id, productId: product._id } },
        { upsert: true, new: true }
      )
    )
  );

  return tenant;
}

export async function getTenantById(id: string): Promise<TenantDocument> {
  const tenant = await Tenant.findById(id);
  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}

export async function getTenantBySubdomain(subdomain: string): Promise<TenantDocument> {
  const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase() });
  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}
