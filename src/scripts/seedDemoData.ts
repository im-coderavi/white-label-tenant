import { Plan } from '../models/Plan';
import { Product, ProductType } from '../models/Product';
import { ProductVersion } from '../models/ProductVersion';
import { License } from '../models/License';
import { Tenant, TenantDocument } from '../models/Tenant';
import { User } from '../models/User';
import { ResellerProduct } from '../models/ResellerProduct';
import { Subscription } from '../models/Subscription';
import { Category } from '../models/Category';
import { syncProductToTenants } from '../modules/products/products.service';
import { generateLicenseKey, generateSubscriptionKey } from '../common/licenseKey';
import { hashPassword } from '../common/password';
import { logger } from '../common/logger';
import { STARTER_FLAGS, PREMIUM_FLAGS, AGENCY_FLAGS } from '../common/planEntitlements';

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
    featureFlagsJson: STARTER_FLAGS,
    limitsJson: { maxOwnProducts: 0 },
  },
  {
    name: 'Premium',
    price: 2999,
    billingCycle: 'monthly' as const,
    featureFlagsJson: PREMIUM_FLAGS,
    limitsJson: { maxOwnProducts: 25 },
  },
  {
    name: 'Agency',
    price: 6999,
    billingCycle: 'monthly' as const,
    featureFlagsJson: AGENCY_FLAGS,
    limitsJson: {},
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
    if (existing) {
      existing.featureFlagsJson = plan.featureFlagsJson as Record<string, unknown>;
      existing.limitsJson = plan.limitsJson as Record<string, unknown>;
      existing.price = plan.price;
      existing.billingCycle = plan.billingCycle;
      existing.status = 'active';
      await existing.save();
      continue;
    }
    await Plan.create({ ...plan, scope: 'reseller', currency: 'INR', status: 'active' });
  }

  // Retire stale plan tiers from earlier seed shapes so the admin Plans page only shows the current lineup.
  const currentNames = DEMO_PLANS.map((p) => p.name);
  await Plan.updateMany(
    { scope: 'reseller', name: { $nin: currentNames } },
    { $set: { status: 'archived' } }
  );

  logger.info(`Seeded ${DEMO_PLANS.length} reseller plans`);
}

interface CategoryTreeNode {
  name: string;
  slug: string;
  icon: string;
  children?: Array<{ name: string; slug: string }>;
}

/** The full marketplace taxonomy the reseller sidebar filters by — mirrors the requested nav tree exactly. */
const MASTER_CATEGORY_TREE: CategoryTreeNode[] = [
  {
    name: 'Design & Creative',
    slug: 'design-creative',
    icon: 'palette',
    children: [
      { name: 'Canva Tools', slug: 'canva-tools' },
      { name: 'Graphics Tools', slug: 'graphics-tools' },
      { name: 'AI Design Tools', slug: 'ai-design-tools' },
    ],
  },
  {
    name: 'AI Tools',
    slug: 'ai-tools',
    icon: 'sparkles',
    children: [
      { name: 'AI Content', slug: 'ai-content' },
      { name: 'AI Image', slug: 'ai-image' },
      { name: 'AI Video', slug: 'ai-video' },
      { name: 'AI Agents', slug: 'ai-agents' },
      { name: 'ChatGPT Tools', slug: 'chatgpt-tools' },
    ],
  },
  {
    name: 'WhatsApp Tools',
    slug: 'whatsapp-tools',
    icon: 'message-circle',
    children: [
      { name: 'WhatsApp Automation', slug: 'whatsapp-automation' },
      { name: 'WhatsApp Marketing', slug: 'whatsapp-marketing' },
      { name: 'WhatsApp Store', slug: 'whatsapp-store' },
      { name: 'WhatsApp Extractors', slug: 'whatsapp-extractors' },
    ],
  },
  {
    name: 'Marketing Tools',
    slug: 'marketing-tools',
    icon: 'megaphone',
    children: [
      { name: 'Social Media', slug: 'social-media' },
      { name: 'Auto Poster', slug: 'auto-poster' },
      { name: 'Lead Generation', slug: 'lead-generation' },
      { name: 'Marketing Automation', slug: 'marketing-automation' },
    ],
  },
  {
    name: 'Scrapers & Extractors',
    slug: 'scrapers-extractors',
    icon: 'search',
    children: [
      { name: 'Google Maps Scraper', slug: 'google-maps-scraper' },
      { name: 'IndiaMART Scraper', slug: 'indiamart-scraper' },
      { name: 'Data Scrapers', slug: 'data-scrapers' },
      { name: 'Contact Extractors', slug: 'contact-extractors' },
    ],
  },
  {
    name: 'Website & WordPress',
    slug: 'website-wordpress',
    icon: 'globe',
    children: [
      { name: 'WordPress Themes', slug: 'wordpress-themes' },
      { name: 'WordPress Plugins', slug: 'wordpress-plugins' },
      { name: 'Landing Pages', slug: 'landing-pages' },
      { name: 'Website Scripts', slug: 'website-scripts' },
    ],
  },
  {
    name: 'Business Software',
    slug: 'business-software',
    icon: 'briefcase',
    children: [
      { name: 'Billing Software', slug: 'billing-software' },
      { name: 'CRM', slug: 'crm' },
      { name: 'HR Software', slug: 'hr-software' },
      { name: 'Business Management', slug: 'business-management' },
    ],
  },
  {
    name: 'SEO Tools',
    slug: 'seo-tools',
    icon: 'trending-up',
    children: [
      { name: 'SEO', slug: 'seo' },
      { name: 'Keyword Tools', slug: 'keyword-tools' },
      { name: 'Content Tools', slug: 'content-tools' },
    ],
  },
  {
    name: 'Video & Media',
    slug: 'video-media',
    icon: 'video',
    children: [
      { name: 'Video Tools', slug: 'video-tools' },
      { name: 'Reels Tools', slug: 'reels-tools' },
      { name: 'Media Tools', slug: 'media-tools' },
    ],
  },
  {
    name: 'Utility Tools',
    slug: 'utility-tools',
    icon: 'wrench',
    children: [
      { name: 'PDF Tools', slug: 'pdf-tools' },
      { name: 'File Tools', slug: 'file-tools' },
      { name: 'Developer Tools', slug: 'developer-tools' },
      { name: 'Other Tools', slug: 'other-tools' },
    ],
  },
];

async function seedCategories(): Promise<void> {
  let sortOrder = 0;
  for (const group of MASTER_CATEGORY_TREE) {
    sortOrder += 1;
    let parent = await Category.findOne({ tenantId: null, slug: group.slug });
    if (!parent) {
      parent = await Category.create({
        tenantId: null,
        name: group.name,
        slug: group.slug,
        icon: group.icon,
        sortOrder,
      });
    } else if (parent.name !== group.name || parent.icon !== group.icon || parent.parentId) {
      parent.name = group.name;
      parent.icon = group.icon;
      parent.parentId = null;
      parent.sortOrder = sortOrder;
      await parent.save();
    }

    let childOrder = 0;
    for (const child of group.children ?? []) {
      childOrder += 1;
      const existingChild = await Category.findOne({ tenantId: null, slug: child.slug });
      if (!existingChild) {
        await Category.create({
          tenantId: null,
          name: child.name,
          slug: child.slug,
          icon: group.icon,
          parentId: parent._id,
          sortOrder: childOrder,
        });
      } else if (
        existingChild.name !== child.name ||
        existingChild.parentId?.toString() !== parent._id.toString()
      ) {
        existingChild.name = child.name;
        existingChild.icon = group.icon;
        existingChild.parentId = parent._id;
        existingChild.sortOrder = childOrder;
        await existingChild.save();
      }
    }
  }

  // Remove master categories from earlier seed shapes that aren't part of the current tree.
  const currentSlugs = MASTER_CATEGORY_TREE.flatMap((group) => [
    group.slug,
    ...(group.children ?? []).map((child) => child.slug),
  ]);
  await Category.deleteMany({ tenantId: null, slug: { $nin: currentSlugs } });

  logger.info(`Seeded ${MASTER_CATEGORY_TREE.length} master category groups`);
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

async function seedStore(password: string): Promise<TenantDocument> {
  const subdomain = 'resell';

  let tenant = await Tenant.findOne({ subdomain });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'ResellRights Shop',
      subdomain,
      status: 'active',
      brandingJson: {
        siteName: 'ResellRights Store',
        themeColor: '#4f46e5',
        footerText: '© 2026 ResellRights. All rights reserved.',
      },
      supportJson: {
        supportEmail: 'support@resellrights.shop',
        whatsappNumber: '+919876543210',
      },
      storefrontJson: {
        heroTitle: 'Resell Premium Digital Products with 100% Margin',
        heroSubtitle: 'Access 10,000+ software tools, reels bundles, themes & AI tools on your own white-label brand.',
        landingTemplate: 'professional',
      },
      storeSettingsJson: {
        sellingMode: 'both',
        defaultVisibility: true,
      },
    });
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
        licenseKey: generateSubscriptionKey(),
      });
    }
  }

  const passwordHash = await hashPassword(password);
  const competitorHash = await hashPassword('123456');

  // Competitor requested user
  const competitorUser = await User.findOne({ tenantId: tenant._id, email: 'reseller@gmail.com' });
  if (!competitorUser) {
    await User.create({
      tenantId: tenant._id,
      role: 'reseller_admin',
      email: 'reseller@gmail.com',
      passwordHash: competitorHash,
      status: 'active',
    });
  }

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

import { seedMasterAdmin } from './seedMasterAdmin';

export async function seedDemoData(): Promise<void> {
  const password = process.env.SEED_DEMO_PASSWORD ?? 'demopass123';
  process.env.SEED_MASTER_ADMIN_EMAIL = process.env.SEED_MASTER_ADMIN_EMAIL || 'admin@toolzypro.com';
  process.env.SEED_MASTER_ADMIN_PASSWORD = process.env.SEED_MASTER_ADMIN_PASSWORD || 'admin1234';
  await seedMasterAdmin();
  await seedPlans();
  await seedCategories();
  const tenant = await seedStore(password);
  await seedProducts();
  await customiseStoreCatalog(tenant);
  logger.info('Demo data ready', {
    storeSubdomain: 'resell',
    resellerCompetitorLogin: 'reseller@gmail.com',
    competitorPassword: '123456',
    password,
  });
}

if (require.main === module) {
  const { connectDb, disconnectDb } = require('../config/db');
  connectDb()
    .then(() => seedDemoData())
    .then(() => disconnectDb())
    .catch((err: unknown) => {
      logger.error('Failed to seed demo data', { error: err instanceof Error ? err.stack : err });
      process.exit(1);
    });
}
