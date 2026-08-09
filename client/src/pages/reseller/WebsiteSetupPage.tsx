import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Alert } from '../../components/ui/alert';
import { Palette, PhoneCall, Layout, CheckCircle, Sparkles } from 'lucide-react';

interface FullSettings {
  storeName: string;
  subdomain: string;
  customDomain: string | null;
  branding: {
    siteName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    themeColor?: string;
    footerText?: string;
  };
  support: {
    supportEmail?: string;
    whatsappNumber?: string;
    officeAddress?: string;
    jurisdiction?: string;
    socialLinks?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      youtube?: string;
      telegram?: string;
      linkedin?: string;
      whatsapp?: string;
    };
    trustpilotUrl?: string;
    trustpilotWidgetToken?: string;
  };
  storefront: {
    heroTitle?: string;
    heroSubtitle?: string;
    facebookPixelId?: string;
    seoTitle?: string;
    seoDescription?: string;
  };
}

export default function WebsiteSetupPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'branding' | 'support' | 'storefront'>('branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<FullSettings>({
    storeName: '',
    subdomain: '',
    customDomain: null,
    branding: {
      siteName: '',
      logoUrl: '',
      faviconUrl: '',
      themeColor: '#4f46e5',
      footerText: '',
    },
    support: {
      supportEmail: '',
      whatsappNumber: '',
      officeAddress: '',
      jurisdiction: '',
      socialLinks: {},
      trustpilotUrl: '',
    },
    storefront: {
      heroTitle: '',
      heroSubtitle: '',
      facebookPixelId: '',
      seoTitle: '',
      seoDescription: '',
    },
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ store: FullSettings }>('/reseller/settings');
      if (res.store) {
        setSettings({
          storeName: res.store.storeName || '',
          subdomain: res.store.subdomain || '',
          customDomain: res.store.customDomain || null,
          branding: { ...res.store.branding },
          support: { ...res.store.support, socialLinks: res.store.support?.socialLinks || {} },
          storefront: { ...res.store.storefront },
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await apiPatch('/reseller/settings', {
        storeName: settings.storeName,
        branding: settings.branding,
        support: settings.support,
        storefront: settings.storefront,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save store branding settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400">Loading website setup settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Palette className="w-6 h-6 text-indigo-400" />
          Website Setup & Branding
        </h1>
        <p className="text-sm text-slate-400">
          Fully white-label your digital store with custom logo, colors, support contacts, and storefront text.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'branding'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          Branding & Logo
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'support'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          Support & Social Links
        </button>

        <button
          onClick={() => setActiveTab('storefront')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'storefront'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layout className="w-4 h-4" />
          Storefront Customizer
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: Branding & Logo */}
        {activeTab === 'branding' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white">Brand Identity & Styling</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Store/Site Name</Label>
                <Input
                  placeholder="My Digital Store"
                  value={settings.storeName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      storeName: e.target.value,
                      branding: { ...settings.branding, siteName: e.target.value },
                    })
                  }
                />
              </div>

              <div>
                <Label>Theme Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.branding.themeColor || '#4f46e5'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        branding: { ...settings.branding, themeColor: e.target.value },
                      })
                    }
                    className="w-10 h-10 rounded-lg cursor-pointer bg-slate-800 border border-slate-700"
                  />
                  <Input
                    value={settings.branding.themeColor || '#4f46e5'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        branding: { ...settings.branding, themeColor: e.target.value },
                      })
                    }
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Custom Store Logo URL (PNG/SVG)</Label>
                <Input
                  placeholder="https://mybrand.com/logo.png"
                  value={settings.branding.logoUrl || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      branding: { ...settings.branding, logoUrl: e.target.value },
                    })
                  }
                />
                <p className="text-xs text-slate-500 mt-1">Recommended: Transparent PNG or SVG logo.</p>
              </div>

              <div>
                <Label>Favicon URL</Label>
                <Input
                  placeholder="https://mybrand.com/favicon.ico"
                  value={settings.branding.faviconUrl || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      branding: { ...settings.branding, faviconUrl: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Footer Copyright Text</Label>
              <Input
                placeholder="© 2026 My Brand Name. All rights reserved."
                value={settings.branding.footerText || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    branding: { ...settings.branding, footerText: e.target.value },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* Tab 2: Support & Social Links */}
        {activeTab === 'support' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white">Customer Support & Social Profiles</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Support Email Address</Label>
                <Input
                  placeholder="support@mybrand.com"
                  value={settings.support.supportEmail || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      support: { ...settings.support, supportEmail: e.target.value },
                    })
                  }
                />
              </div>

              <div>
                <Label>WhatsApp Support Number</Label>
                <Input
                  placeholder="+919876543210"
                  value={settings.support.whatsappNumber || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      support: { ...settings.support, whatsappNumber: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Office Address</Label>
                <Input
                  placeholder="123 Business Hub, Suite 400"
                  value={settings.support.officeAddress || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      support: { ...settings.support, officeAddress: e.target.value },
                    })
                  }
                />
              </div>

              <div>
                <Label>Legal Jurisdiction / Country</Label>
                <Input
                  placeholder="India / USA"
                  value={settings.support.jurisdiction || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      support: { ...settings.support, jurisdiction: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Trustpilot Review Store URL (Optional)</Label>
              <Input
                placeholder="https://www.trustpilot.com/review/mybrand.com"
                value={settings.support.trustpilotUrl || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    support: { ...settings.support, trustpilotUrl: e.target.value },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* Tab 3: Storefront Customizer */}
        {activeTab === 'storefront' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white">Storefront Hero & Marketing Settings</h2>

            <div>
              <Label>Landing Page Hero Title</Label>
              <Input
                placeholder="Get Premium Digital Software & Tools"
                value={settings.storefront.heroTitle || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    storefront: { ...settings.storefront, heroTitle: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <Label>Landing Page Hero Subtitle</Label>
              <Input
                placeholder="Instant access to 10,000+ software tools, themes & templates with full support."
                value={settings.storefront.heroSubtitle || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    storefront: { ...settings.storefront, heroSubtitle: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <Label>Facebook / Meta Pixel ID</Label>
              <Input
                placeholder="123456789012345"
                value={settings.storefront.facebookPixelId || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    storefront: { ...settings.storefront, facebookPixelId: e.target.value },
                  })
                }
              />
              <p className="text-xs text-slate-500 mt-1">Track traffic & conversions automatically on your store.</p>
            </div>
          </div>
        )}

        {error && <div className="p-3 bg-rose-950/60 border border-rose-900 text-rose-400 text-sm rounded-lg">{error}</div>}

        {success && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-900 text-emerald-400 text-sm rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Website branding settings updated successfully!
          </div>
        )}

        <Button type="submit" disabled={saving} size="lg">
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </form>
    </div>
  );
}
