import { api } from '../lib/api';

export interface Category {
  _id: string;
  tenantId: string | null;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parentId: string | null;
  sortOrder: number;
}

export interface CategoryTreeNode extends Category {
  children: Category[];
}

export async function listCategories(): Promise<Category[]> {
  const res = await api.get<{ categories: Category[] }>('/categories');
  return res.data.categories;
}

/** Groups a flat category list into a 2-level tree (master categories only have one level of nesting). */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const cat of categories) {
    const key = cat.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cat);
  }
  const roots = (byParent.get(null) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return roots.map((root) => ({
    ...root,
    children: (byParent.get(root._id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
