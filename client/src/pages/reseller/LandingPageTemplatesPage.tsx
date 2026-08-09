import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Code2, Sparkles, Eye, CheckCircle, Monitor } from 'lucide-react';

interface TemplateOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  previewBg: string;
}

const PRESET_TEMPLATES: TemplateOption[] = [
  {
    id: 'professional',
    name: 'Professional Storefront',
    badge: 'Popular',
    description: 'Clean dark/light modern SaaS marketplace theme with hero search & category badges.',
    previewBg: 'from-indigo-900 to-slate-900',
  },
  {
    id: 'modern_light',
    name: 'Modern Light Hub',
    badge: 'Sleek',
    description: 'High-contrast light layout focusing on featured software & instant downloads.',
    previewBg: 'from-blue-600 to-indigo-800',
  },
  {
    id: 'dark_premium',
    name: 'Dark Premium Hub',
    badge: 'Pro',
    description: 'Ultra dark futuristic aesthetic with glassmorphism cards and gradient borders.',
    previewBg: 'from-purple-900 via-slate-900 to-black',
  },
  {
    id: 'minimal',
    name: 'Minimal Sales Hub',
    badge: 'High Conversion',
    description: 'Streamlined single-page product showcase with direct access code redemption.',
    previewBg: 'from-emerald-900 to-slate-900',
  },
  {
    id: 'custom_html',
    name: 'Custom HTML / Raw Code',
    badge: 'Developer Mode',
    description: 'Paste your own complete custom HTML, CSS & JavaScript landing page code.',
    previewBg: 'from-amber-900 to-slate-900',
  },
];

export default function LandingPageTemplatesPage(): JSX.Element {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('professional');
  const [customHtml, setCustomHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ store: any }>('/reseller/settings');
      if (res.store?.storefront) {
        setSelectedTemplate(res.store.storefront.landingTemplate || 'professional');
        setCustomHtml(res.store.storefront.customHtmlContent || '');
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

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await apiPatch('/reseller/settings', {
        storefront: {
          landingTemplate: selectedTemplate,
          customHtmlContent: customHtml,
        },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400">Loading landing templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Code2 className="w-6 h-6 text-indigo-400" />
            Landing Page Templates & Custom HTML
          </h1>
          <p className="text-sm text-slate-400">
            Select a pre-built conversion landing template or paste your own raw HTML code.
          </p>
        </div>
      </div>

      {/* Preset Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PRESET_TEMPLATES.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          return (
            <div
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`cursor-pointer rounded-xl border p-5 flex flex-col justify-between transition-all ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className={`h-28 rounded-lg bg-gradient-to-br ${tmpl.previewBg} p-4 flex flex-col justify-between mb-4 border border-slate-700/50`}>
                  <span className="self-end text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-black/50 text-white backdrop-blur-sm">
                    {tmpl.badge}
                  </span>
                  <Monitor className="w-6 h-6 text-white/80" />
                </div>

                <h3 className="font-semibold text-white text-base flex items-center justify-between">
                  <span>{tmpl.name}</span>
                  {isSelected && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                </h3>

                <p className="text-xs text-slate-400 mt-2">{tmpl.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className={isSelected ? 'text-indigo-400 font-medium' : 'text-slate-500'}>
                  {isSelected ? 'Active Template' : 'Click to Select'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom HTML Editor Section (Visible when Custom HTML selected) */}
      {selectedTemplate === 'custom_html' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-amber-400" />
              Custom Raw HTML / CSS / JS Editor
            </h2>
            <span className="text-xs text-amber-400 bg-amber-950/50 px-2.5 py-1 rounded border border-amber-800">
              Developer Mode Active
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Paste your raw HTML landing page layout below. You can include standard CSS style tags and script tags.
          </p>

          <textarea
            rows={14}
            value={customHtml}
            onChange={(e) => setCustomHtml(e.target.value)}
            placeholder="<!DOCTYPE html><html><head><style>body { background: #0f172a; color: white; }</style></head><body><h1>Welcome to My Store</h1></body></html>"
            className="w-full font-mono text-xs p-4 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-900 text-emerald-400 text-sm rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Landing page template updated successfully!
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving ? 'Applying...' : 'Apply Landing Template'}
      </Button>
    </div>
  );
}
