import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import { KeyRound } from 'lucide-react';

interface LicenseItem {
  _id: string;
  key: string;
  status: string;
  productId: { _id: string; name: string } | null;
  tenantId: { _id: string; name: string } | null;
  createdAt: string;
}

const STATUS_TITLE: Record<string, string> = {
  assigned: 'Issued Keys',
  expired: 'Expired Keys',
};

export default function LicensesPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await apiGet<{ items: LicenseItem[] }>(`/admin/licenses${query}`);
      setLicenses(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            {statusFilter ? STATUS_TITLE[statusFilter] ?? 'License Keys' : 'License Keys Pool'}
          </h1>
          <p className="text-sm text-slate-400">
            Central repository of auto-generated TZP license keys across products.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Keys ({licenses.length})</h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading licenses...</div>
        ) : licenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No licenses in pool.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                  <th className="py-3 px-4">License Key</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Reseller Store</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {licenses.map((lic) => (
                  <tr key={lic._id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">{lic.key}</td>
                    <td className="py-3 px-4 text-slate-200">{lic.productId?.name || 'Global'}</td>
                    <td className="py-3 px-4 text-slate-400">{lic.tenantId?.name || 'Master Pool'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          lic.status === 'available'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : lic.status === 'assigned' || lic.status === 'activated'
                            ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {lic.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(lic.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
