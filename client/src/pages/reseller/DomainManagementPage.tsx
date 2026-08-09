import { useState, useEffect } from 'react';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Globe, ShieldCheck, CheckCircle2, Clock, Copy, ArrowRight, ExternalLink } from 'lucide-react';

interface DomainSettings {
  subdomain: string;
  customDomain: string | null;
  domainVerified: boolean;
  sslStatus: string;
}

export default function DomainManagementPage(): JSX.Element {
  const [data, setData] = useState<DomainSettings | null>(null);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDomain = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ store: DomainSettings }>('/reseller/settings');
      if (res.store) {
        setData(res.store);
        setCustomDomainInput(res.store.customDomain || '');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomain();
  }, []);

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiPatch<{ store: DomainSettings }>('/reseller/settings', {
        customDomain: customDomainInput || null,
      });
      setData(res.store);
      setSuccess('Custom domain saved. Please configure DNS records below and click Verify.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update custom domain.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDns = async () => {
    setVerifying(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ store: DomainSettings }>('/reseller/verify-domain', {});
      setData(res.store);
      setSuccess('DNS verified successfully! Free SSL Certificate has been provisioned.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'DNS verification failed. Ensure records are propagated.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400">Loading domain settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-400" />
          Custom Domain & DNS Setup
        </h1>
        <p className="text-sm text-slate-400">
          Connect your custom domain (e.g. <span className="font-mono text-indigo-400">mydigitalstore.com</span>) to run your store on your own domain with free automatic SSL.
        </p>
      </div>

      {/* Domain Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Free Subdomain Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Free Platform Subdomain</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active
            </span>
          </div>

          <div className="text-xl font-bold font-mono text-white">
            {data?.subdomain}.toolzypro.in
          </div>

          <p className="text-xs text-slate-400">
            Default platform URL assigned to your store. Ready to use immediately.
          </p>
        </div>

        {/* Custom Domain Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Custom Domain Status</span>
            {data?.domainVerified ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified & SSL Active
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Pending Verification
              </span>
            )}
          </div>

          <div className="text-xl font-bold font-mono text-indigo-400">
            {data?.customDomain || 'Not Connected'}
          </div>

          <p className="text-xs text-slate-400">
            {data?.customDomain ? 'Custom domain added. Follow DNS instructions below.' : 'Add your domain below.'}
          </p>
        </div>
      </div>

      {/* Form & Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Connect Your Domain</h2>

        <form onSubmit={handleSaveDomain} className="space-y-4">
          <div>
            <Label>Domain Name or Subdomain</Label>
            <div className="flex gap-3 mt-1.5">
              <Input
                placeholder="mydigitalstore.com or shop.mybrand.in"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                className="font-mono"
              />
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Domain'}
              </Button>
            </div>
          </div>
        </form>

        {error && <div className="p-3 bg-rose-950/60 border border-rose-900 text-rose-400 text-sm rounded-lg">{error}</div>}
        {success && <div className="p-3 bg-emerald-950/60 border border-emerald-900 text-emerald-400 text-sm rounded-lg">{success}</div>}

        {/* DNS Record Instructions */}
        {data?.customDomain && (
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <h3 className="font-semibold text-white text-base">Required DNS Records</h3>
            <p className="text-xs text-slate-400">
              Log into your domain provider (GoDaddy, Namecheap, Cloudflare) and add the following 2 records:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse bg-slate-950 rounded-lg overflow-hidden text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="p-3">Type</th>
                    <th className="p-3">Host / Name</th>
                    <th className="p-3">Target / Value</th>
                    <th className="p-3">TTL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono text-slate-200">
                  <tr>
                    <td className="p-3 text-indigo-400 font-bold">A Record</td>
                    <td className="p-3">@</td>
                    <td className="p-3 text-emerald-400">187.127.180.170</td>
                    <td className="p-3 text-slate-500">Auto / 3600</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-indigo-400 font-bold">CNAME</td>
                    <td className="p-3">www</td>
                    <td className="p-3 text-emerald-400">resellrights.shop</td>
                    <td className="p-3 text-slate-500">Auto / 3600</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                DNS propagation can take between 5 to 15 minutes.
              </p>
              <Button onClick={handleVerifyDns} disabled={verifying} variant="outline" className="gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {verifying ? 'Checking DNS...' : 'Verify DNS & SSL'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
