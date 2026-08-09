import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { FolderTree, Plus, Trash2, Tag } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

export default function CategoriesPage(): JSX.Element {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ categories: Category[] }>('/categories');
      setCategories(res.categories);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name || !slug) return;
    try {
      await apiPost('/categories', { name, slug, description });
      setName('');
      setSlug('');
      setDescription('');
      fetchCategories();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await apiDelete(`/categories/${id}`);
      fetchCategories();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <FolderTree className="w-6 h-6 text-indigo-400" />
          Product Categories Registry
        </h1>
        <p className="text-sm text-slate-400">
          Manage master categories available to resellers across the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Category Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-fit">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            Add New Category
          </h2>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Category Name</Label>
              <Input
                placeholder="e.g. Reels Bundle & Assets"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div>
              <Label>Slug</Label>
              <Input placeholder="reels-bundle" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                placeholder="Short description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && <div className="text-xs text-rose-400 bg-rose-950/50 p-2.5 rounded-lg border border-rose-900">{error}</div>}

            <Button type="submit" className="w-full">
              Create Category
            </Button>
          </form>
        </div>

        {/* Category List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
            <span>Existing Categories ({categories.length})</span>
          </h2>

          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No categories found. Add one above.</div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between p-4 bg-slate-800/60 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{cat.name}</div>
                      <div className="text-xs font-mono text-indigo-400">/{cat.slug}</div>
                      {cat.description && <div className="text-xs text-slate-400 mt-1">{cat.description}</div>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(cat._id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
