import { Tutorial, TutorialDocument, TutorialCategory } from '../../models/Tutorial';
import { NotFoundError, ConflictError } from '../../common/errors';

export async function listTutorials(category?: TutorialCategory): Promise<TutorialDocument[]> {
  const query = category ? { category, isPublished: true } : { isPublished: true };
  return Tutorial.find(query).sort({ sortOrder: 1, createdAt: -1 });
}

export async function getTutorialBySlug(slug: string): Promise<TutorialDocument> {
  const tutorial = await Tutorial.findOne({ slug, isPublished: true });
  if (!tutorial) {
    throw new NotFoundError('Tutorial not found');
  }
  return tutorial;
}

export async function seedInitialTutorials(): Promise<void> {
  const count = await Tutorial.countDocuments();
  if (count > 0) return;

  const initialGuides = [
    {
      title: 'Quick Start: Launching Your White-Label Store',
      slug: 'quick-start-launch-store',
      category: 'getting_started' as TutorialCategory,
      description: 'Learn how to configure branding, connect domains, and publish products in under 10 minutes.',
      contentMarkdown: `# Launch Your Store

1. Go to **Website Setup** and upload your logo & set theme color.
2. Go to **Domain Management** and map your custom domain.
3. Select pre-made **Landing Page Templates** or paste raw HTML.
4. Enable products from **Product Catalog** and set your custom pricing.`,
      sortOrder: 1,
    },
    {
      title: 'Custom Domain & DNS Setup Guide',
      slug: 'custom-domain-dns-setup',
      category: 'domains' as TutorialCategory,
      description: 'Step-by-step instructions to map your custom domain and issue SSL certificates.',
      contentMarkdown: `# Custom Domain Setup

- Add an **A Record** pointing \`@\` to \`187.127.180.170\`
- Add a **CNAME Record** pointing \`www\` to \`toolzypro.in\`
- Click **Verify DNS** in Domain Management.`,
      sortOrder: 2,
    },
    {
      title: 'Generating & Managing Access Codes',
      slug: 'generating-access-codes',
      category: 'access_codes' as TutorialCategory,
      description: 'How to issue access codes to customers for seamless product access.',
      contentMarkdown: `# Access Codes Guide

Access codes allow you to grant product access to custom clients or buyers.

1. Go to **Customers & Access Codes**.
2. Click **Generate Access Code**.
3. Select the target product & customer.
4. Send the \`TZP-YYYY-XXXX\` code to your customer to redeem on your store!`,
      sortOrder: 3,
    },
  ];

  await Tutorial.insertMany(initialGuides);
}
