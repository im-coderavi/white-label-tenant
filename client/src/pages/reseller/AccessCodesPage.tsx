import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { KeyRound, Plus, Copy, Check, ShieldAlert, UserPlus, Sparkles, RefreshCw } from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  accessCodes: number;
}

interface AccessCodeItem {
  _id: string;
  code: string;
  status: string;
  createdAt: string;
  customer: { _id: string; name: string; email: string } | null;
  product: { _id: string; name: string; type: string } | null;
  licenseKey: string | null;
}

interface ProductItem {
  _id: string;
  name: string;
}

export default function AccessCodesPage(): JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCodeItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Customer State
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Generate Access Code State
  const [selectedCustId, setSelectedCustId] = useState('');
  const [selectedProdId, setSelectedProdId] = useState('');

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, aRes, pRes] = await Promise.all([
        apiGet<{ customers: Customer[] }>('/reseller/customers'),
        apiGet<{ accessCodes: AccessCodeItem[] }>('/reseller/access-codes'),
        apiGet<{ items: any[] }>('/reseller/products'),
      ]);
      setCustomers(cRes.customers || []);
      setAccessCodes(aRes.accessCodes || []);
      setProducts((pRes.items || []).map((i: any) => ({ _id: i.productId._id, name: i.productId.name })));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!custName || !custEmail) return;

    try {
      await apiPost('/reseller/customers', { name: custName, email: custEmail, phone: custPhone });
      setCustName('');
      setCustEmail('');
      setCustPhone('');
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add customer.');
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedCustId || !selectedProdId) {
      setError('Select both a customer and a product to issue access code.');
      return;
    }

    try {
      await apiPost(`/reseller/customers/${selectedCustId}/access-codes`, { productId: selectedProdId });
      setSelectedCustId('');
      setSelectedProdId('');
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to generate access code.');
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-indigo-400" />
          Customers & Access Codes Management
        </h1>
        <p className="text-sm text-slate-400">
          Issue unique access codes (<span className="font-mono text-indigo-400">TZP-YYYY-XXXX</span>) to your clients. Customers redeem codes on your store to claim product licenses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Customer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            1. Register Customer
          </h2>

          <form onSubmit={handleCreateCustomer} className="space-y-3">
            <div>
              <Label>Customer Name</Label>
              <Input placeholder="John Doe" value={custName} onChange={(e) => setCustName(e.target.value)} />
            </div>

            <div>
              <Label>Customer Email</Label>
              <Input placeholder="client@example.com" type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
            </div>

            <div>
              <Label>Phone (Optional)</Label>
              <Input placeholder="+919876543210" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
            </div>

            <Button type="submit" className="w-full">
              Add Customer
            </Button>
          </form>
        </div>

        {/* Generate Access Code */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            2. Issue Access Code
          </h2>

          <form onSubmit={handleGenerateCode} className="space-y-3">
            <div>
              <Label>Select Target Customer</Label>
              <select
                value={selectedCustId}
                onChange={(e) => setSelectedCustId(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Select Product Access</Label>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {error && <div className="p-2.5 text-xs text-rose-400 bg-rose-950/50 rounded border border-rose-900">{error}</div>}

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500">
              Generate Access Code
            </Button>
          </form>
        </div>
      </div>

      {/* Access Codes Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Issued Access Codes ({accessCodes.length})</h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading access codes...</div>
        ) : accessCodes.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No access codes generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="p-3">Access Code</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Assigned License Key</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {accessCodes.map((ac) => (
                  <tr key={ac._id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-indigo-400">{ac.code}</td>
                    <td className="p-3">{ac.customer?.name || 'N/A'}</td>
                    <td className="p-3 text-slate-300">{ac.product?.name || 'N/A'}</td>
                    <td className="p-3 font-mono text-emerald-400">{ac.licenseKey || 'Auto-Assigned on Redeem'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          ac.status === 'active'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                        }`}
                      >
                        {ac.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => copyToClipboard(ac.code)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                      >
                        {copiedCode === ac.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCode === ac.code ? 'Copied' : 'Copy Code'}</span>
                      </button>
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
