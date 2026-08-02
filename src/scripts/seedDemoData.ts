import { Plan } from '../models/Plan';
import { Product, ProductType } from '../models/Product';
import { ProductVersion } from '../models/ProductVersion';
import { License } from '../models/License';
import { Tenant, TenantDocument } from '../models/Tenant';
import { User } from '../models/User';
import { ResellerProduct } from '../models/ResellerProduct';
import { Subscription } from '../models/Subscription';
import { syncProductToTenants } from '../modules/products/products.service';
import { generateLicenseKey } from '../common/licenseKey';
import { hashPassword } from '../common/password';
import { logger } from '../common/logger';

type SyncMode = 'global' | 'optional' | 'private' | 'exclusive';

interface DemoProduct {
  name: string;
  type: ProductType;
  description: string;
  basePrice: number;
  syncMode: SyncMode;
  featured?: boolean;
}

const DEMO_PLANS = [
  {
    name: 'Starter',
    price: 999,
    billingCycle: 'monthly' as const,
    featureFlagsJson: { customDomain: false, staffSeats: false },
    limitsJson: { products: 25 },
  },
  {
    name: 'Premium',
    price: 4999,
    billingCycle: 'annual' as const,
    featureFlagsJson: { customDomain: true, staffSeats: false },
    limitsJson: { products: 200 },
  },
  {
    name: 'Ultimate',
    price: 9999,
    billingCycle: 'annual' as const,
    featureFlagsJson: { customDomain: true, staffSeats: true },
    limitsJson: { products: 1000 },
  },
  {
    name: 'Lifetime',
    price: 14999,
    billingCycle: 'lifetime' as const,
    featureFlagsJson: { customDomain: true, staffSeats: true, prioritySupport: true },
    limitsJson: { products: 0 },
  },
];

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: 'Ecommerce Starter Kit',
    type: 'landing_page',
    description: 'A complete storefront theme with cart, checkout, and an admin panel.',
    basePrice: 2499,
    syncMode: 'global',
    featured: true,
  },
  {
    name: 'POS Billing Admin Panel',
    type: 'software',
    description: 'Point-of-sale billing with inventory, GST invoices, and daily reports.',
    basePrice: 3999,
    syncMode: 'global',
  },
  {
    name: 'Invoice Manager Pro',
    type: 'software',
    description: 'Recurring invoices, payment reminders, and client statements.',
    basePrice: 1799,
    syncMode: 'global',
  },
  {
    name: 'AI Copywriter Studio',
    type: 'ai_tool',
    description: 'Generate ad copy, product descriptions, and email sequences in seconds.',
    basePrice: 2999,
    syncMode: 'global',
    featured: true,
  },
  {
    name: 'AI Image Upscaler',
    type: 'ai_tool',
    description: 'Batch-upscale product photos to print resolution without artefacts.',
    basePrice: 1499,
    syncMode: 'optional',
  },
  {
    name: 'Chatbot Builder',
    type: 'ai_tool',
    description: 'Drag-and-drop chatbot flows with WhatsApp and web widget delivery.',
    basePrice: 4499,
    syncMode: 'optional',
  },
  {
    name: 'Nova Portfolio Theme',
    type: 'theme',
    description: 'A minimal portfolio theme with case-study layouts and dark mode.',
    basePrice: 999,
    syncMode: 'global',
  },
  {
    name: 'Agency Landing Theme',
    type: 'theme',
    description: 'Conversion-focused agency theme with pricing and testimonial blocks.',
    basePrice: 1299,
    syncMode: 'optional',
    featured: true,
  },
  {
    name: 'SEO Booster Plugin',
    type: 'plugin',
    description: 'Schema markup, sitemaps, and on-page checks for WordPress sites.',
    basePrice: 899,
    syncMode: 'global',
  },
  {
    name: 'Backup & Restore Plugin',
    type: 'plugin',
    description: 'Scheduled off-site backups with one-click restore points.',
    basePrice: 749,
    syncMode: 'optional',
  },
  {
    name: 'Social Media Reels Pack',
    type: 'template',
    description: '120 editable reel templates for festivals, offers, and launches.',
    basePrice: 599,
    syncMode: 'global',
    featured: true,
  },
  {
    name: 'Festival Poster Bundle',
    type: 'template',
    description: '400 print-ready posters covering every major Indian festival.',
    basePrice: 699,
    syncMode: 'global',
  },
  {
    name: 'Pitch Deck Templates',
    type: 'template',
    description: 'Investor-ready decks in Figma, Keynote, and PowerPoint.',
    basePrice: 1199,
    syncMode: 'optional',
  },
  {
    name: 'Dropshipping Masterclass',
    type: 'course',
    description: 'Eighteen lessons on sourcing, pricing, and paid acquisition.',
    basePrice: 3499,
    syncMode: 'optional',
  },
  {
    name: 'Digital Marketing Bootcamp',
    type: 'course',
    description: 'SEO, paid ads, and retention marketing with downloadable worksheets.',
    basePrice: 4999,
    syncMode: 'optional',
  },
  {
    name: 'Automation Scripts Vault',
    type: 'script',
    description: 'Fifty Python and Node scripts for scraping, reporting, and backups.',
    basePrice: 1599,
    syncMode: 'optional',
  },
  {
    name: 'SaaS Boilerplate',
    type: 'digital_download',
    description: 'Auth, billing, and multi-tenancy wired up and ready to extend.',
    basePrice: 5999,
    syncMode: 'global',
  },
  {
    name: 'Brand Identity Kit',
    type: 'bundle',
    description: 'Logos, colour systems, and stationery mockups for new brands.',
    basePrice: 2199,
    syncMode: 'optional',
  },
];

const LICENSES_PER_PRODUCT = 5;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function seedPlans(): Promise<void> {
  for (const plan of DEMO_PLANS) {
    const existing = await Plan.findOne({ scope: 'reseller', name: plan.name });
    if (existing) continue;
    await Plan.create({ ...plan, scope: 'reseller', currency: 'INR', status: 'active' });
  }
  logger.info(`Seeded ${DEMO_PLANS.length} reseller plans`);
}

async function seedProducts(): Promise<void> {
  for (const demo of DEMO_PRODUCTS) {
    const slug = slugify(demo.name);
    let product = await Product.findOne({ slug });

    if (!product) {
      product = await Product.create({
        name: demo.name,
        slug,
        type: demo.type,
        description: demo.description,
        basePrice: demo.basePrice,
        currency: 'INR',
        status: 'draft',
        syncMode: demo.syncMode,
      });
    }

    const hasVersion = await ProductVersion.findOne({ productId: product._id });
    if (!hasVersion) {
      await ProductVersion.create({
        productId: product._id,
        version: '1.0.0',
        changelog: 'Initial release.',
      });
      product.currentVersion = '1.0.0';
      product.changelogJson = { version: '1.0.0', changelog: 'Initial release.' };
    }

    product.status = 'published';
    await product.save();
    await syncProductToTenants(product);

    const licenseCount = await License.countDocuments({ productId: product._id });
    if (licenseCount < LICENSES_PER_PRODUCT) {
      const missing = LICENSES_PER_PRODUCT - licenseCount;
      await License.insertMany(
        Array.from({ length: missing }, () => ({
          productId: product!._id,
          key: generateLicenseKey(),
          status: 'available',
          activationLimit: 1,
        }))
      );
    }
  }
  logger.info(`Seeded ${DEMO_PRODUCTS.length} published demo products`);
}

/**
 * Creates the demo store and its people. Must run before products are seeded so the
 * sync engine has a tenant to propagate rows to.
 */
async function seedStore(password: string): Promise<TenantDocument> {
  const subdomain = 'nova';

  let tenant = await Tenant.findOne({ subdomain });
  if (!tenant) {
    tenant = await Tenant.create({ name: 'Nova Digital', subdomain, status: 'active' });
  }

  const plan = await Plan.findOne({ scope: 'reseller', name: 'Premium' });
  if (plan) {
    const hasSubscription = await Subscription.findOne({ tenantId: tenant._id });
    if (!hasSubscription) {
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      await Subscription.create({
        tenantId: tenant._id,
        planId: plan._id,
        status: 'active',
        currentPeriodEnd: periodEnd,
      });
    }
  }

  const passwordHash = await hashPassword(password);
  const people = [
    { email: 'reseller@demo.local', role: 'reseller_admin' as const },
    { email: 'customer@demo.local', role: 'customer' as const },
  ];
  for (const person of people) {
    const existing = await User.findOne({ tenantId: tenant._id, email: person.email });
    if (existing) continue;
    await User.create({
      tenantId: tenant._id,
      role: person.role,
      email: person.email,
      passwordHash,
      status: 'active',
    });
  }

  logger.info(`Seeded demo store "${tenant.name}" at subdomain "${subdomain}"`);
  return tenant;
}

/** Gives the demo store a realistic mix: opted-in products, discounts, and featured picks. */
async function customiseStoreCatalog(tenant: TenantDocument): Promise<void> {
  let touched = 0;
  for (const demo of DEMO_PRODUCTS) {
    const product = await Product.findOne({ slug: slugify(demo.name) });
    if (!product) continue;

    const row = await ResellerProduct.findOne({ tenantId: tenant._id, productId: product._id });
    if (!row) continue;

    if (demo.syncMode === 'optional') {
      row.enabled = true;
    }
    if (demo.featured) {
      row.isFeatured = true;
    }
    if (demo.basePrice >= 3000 && row.customPrice == null) {
      row.discountPercent = 15;
    }
    await row.save();
    touched += 1;
  }
  logger.info(`Configured ${touched} catalog rows for the demo store`);
}

export async function seedDemoData(): Promise<void> {
  const password = process.env.SEED_DEMO_PASSWORD ?? 'demopass123';
  await seedPlans();
  // The store must exist before products sync, or its catalog rows are never created.
  const tenant = await seedStore(password);
  await seedProducts();
  await customiseStoreCatalog(tenant);
  logger.info('Demo data ready', {
    storeSubdomain: 'nova',
    resellerLogin: 'reseller@demo.local',
    customerLogin: 'customer@demo.local',
    password,
  });
}

/* istanbul ignore next -- exercised manually via `npm run seed:demo`, not under test */
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { connectDb, disconnectDb } = require('../config/db');
  connectDb()
    .then(() => seedDemoData())
    .then(() => disconnectDb())
    .catch((err: unknown) => {
      logger.error('Failed to seed demo data', { error: err instanceof Error ? err.stack : err });
      process.exit(1);
    });
}
