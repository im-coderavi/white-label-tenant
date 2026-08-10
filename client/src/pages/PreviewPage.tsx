import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

export default function PreviewPage(): JSX.Element {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [store, setStore] = useState<any | null>(null);

  useEffect(() => {
    apiGet<{ store: any }>('/customer/products/public-config')
      .then((res: { store: any }) => {
        if (res.store) setStore(res.store);
      })
      .catch(() => {});
  }, []);

  const deviceWidths = {
    desktop: 'w-full',
    tablet: 'max-w-2xl',
    mobile: 'max-w-sm',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Preview Controls Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Live Preview Mode</span>
          <span className="text-xs text-slate-400 font-mono">({store?.name || 'Reseller Store'})</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded transition-colors ${device === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded transition-colors ${device === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded transition-colors ${device === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 p-6 flex justify-center bg-slate-950 overflow-auto">
        <div className={`h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all ${deviceWidths[device]}`}>
          <iframe
            src="/account/store"
            title="Live Preview"
            className="w-full h-full min-h-[800px] border-0"
          />
        </div>
      </div>
    </div>
  );
}
