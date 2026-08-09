import { Category, CategoryDocument } from '../../models/Category';
import { NotFoundError, ConflictError } from '../../common/errors';

export async function listCategories(tenantId: string | null): Promise<CategoryDocument[]> {
  return Category.find({ tenantId }).sort({ sortOrder: 1, name: 1 });
}

export async function createCategory(
  tenantId: string | null,
  input: { name: string; slug: string; description?: string; icon?: string; parentId?: string | null; sortOrder?: number }
): Promise<CategoryDocument> {
  const existing = await Category.findOne({ tenantId, slug: input.slug });
  if (existing) {
    throw new ConflictError('Category slug already exists');
  }

  return Category.create({
    tenantId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? '',
    icon: input.icon ?? 'folder',
    parentId: input.parentId ?? null,
    sortOrder: input.sortOrder ?? 0,
  });
}

export async function updateCategory(
  id: string,
  tenantId: string | null,
  input: { name?: string; slug?: string; description?: string; icon?: string; parentId?: string | null; sortOrder?: number }
): Promise<CategoryDocument> {
  const category = await Category.findOne({ _id: id, tenantId });
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  if (input.slug && input.slug !== category.slug) {
    const existing = await Category.findOne({ tenantId, slug: input.slug });
    if (existing) throw new ConflictError('Category slug already exists');
    category.slug = input.slug;
  }

  if (input.name !== undefined) category.name = input.name;
  if (input.description !== undefined) category.description = input.description;
  if (input.icon !== undefined) category.icon = input.icon;
  if (input.parentId !== undefined) category.parentId = input.parentId ? (input.parentId as any) : null;
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;

  await category.save();
  return category;
}

export async function deleteCategory(id: string, tenantId: string | null): Promise<void> {
  const category = await Category.findOneAndDelete({ _id: id, tenantId });
  if (!category) {
    throw new NotFoundError('Category not found');
  }
}
