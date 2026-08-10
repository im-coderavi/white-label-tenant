import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Palette } from 'lucide-react';
import { getBranding, updateBranding } from '../../api/resellerSettings';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input, Label, Textarea } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';

export default function StoreSettingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { data: store, isLoading } = useQuery({ queryKey: ['reseller-branding'], queryFn: getBranding });
  const [form, setForm] = useState({
    storeName: '',
    tagline: '',
    logoUrl: '',
    primaryColor: '#0F766E',
    accentColor: '#F59E0B',
    heroTitle: '',
    heroSubtitle: '',
    supportEmail: '',
    whatsappUrl: '',
    customDomain: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!store) return;
    setForm({
      storeName: store.storeName,
      tagline: store.branding.tagline ?? '',
      logoUrl: store.branding.logoUrl ?? '',
      primaryColor: store.branding.primaryColor ?? '#0F766E',
      accentColor: store.branding.accentColor ?? '#F59E0B',
      heroTitle: store.branding.heroTitle ?? '',
      heroSubtitle: store.branding.heroSubtitle ?? '',
      supportEmail: store.branding.supportEmail ?? '',
      whatsappUrl: store.branding.whatsappUrl ?? '',
      customDomain: store.customDomain ?? '',
    });
  }, [store]);

  const save = async (): Promise<void> => {
    setMessage('');
    try {
      await updateBranding({
        storeName: form.storeName,
        tagline: form.tagline,
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        heroTitle: form.heroTitle,
        heroSubtitle: form.heroSubtitle,
        supportEmail: form.supportEmail || null,
        whatsappUrl: form.whatsappUrl || null,
        customDomain: form.customDomain || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['reseller-branding'] });
      setMessage('Store settings saved.');
    } catch {
      setMessage('Could not save branding. Check URLs, colors, or domain availability.');
    }
  };

  if (isLoading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="White-label"
        title="Store settings"
        description="Control the storefront identity your customers see on your own domain."
        actions={
          <Button variant="outline" asChild>
            <a href={`https://${store?.subdomain}.toolzypro.in`} target="_blank" rel="noreferrer">
              <Eye aria-hidden="true" />
              Preview
            </a>
          </Button>
        }
      />

      {message && (
        <p role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Brand profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="store-name">Store name</Label>
              <Input id="store-name" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="custom-domain">Custom domain</Label>
              <Input id="custom-domain" placeholder="store.example.com" value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input id="logo-url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="support-email">Support email</Label>
              <Input id="support-email" type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="primary-color">Primary color</Label>
              <Input id="primary-color" type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-10 p-1" />
            </div>
            <div>
              <Label htmlFor="accent-color">Accent color</Label>
              <Input id="accent-color" type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-10 p-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="hero-title">Landing page headline</Label>
              <Input id="hero-title" value={form.heroTitle} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="hero-subtitle">Landing page copy</Label>
              <Textarea id="hero-subtitle" value={form.heroSubtitle} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="whatsapp-url">WhatsApp support URL</Label>
              <Input id="whatsapp-url" value={form.whatsappUrl} onChange={(e) => setForm({ ...form, whatsappUrl: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button type="button" onClick={save}>
                <Palette aria-hidden="true" />
                Save branding
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border p-4" style={{ borderColor: form.primaryColor }}>
              <div className="text-xs font-semibold uppercase text-muted">{form.tagline || 'Digital reseller store'}</div>
              <h2 className="mt-3 font-display text-2xl font-bold" style={{ color: form.primaryColor }}>
                {form.heroTitle || form.storeName || 'Your branded store'}
              </h2>
              <p className="mt-2 text-sm text-muted">{form.heroSubtitle || 'Sell products under your own brand.'}</p>
              <div className="mt-5 inline-flex rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: form.accentColor }}>
                Browse products
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
