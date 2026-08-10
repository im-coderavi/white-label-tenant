import { useState, useEffect } from 'react';
import { apiGet } from '../../lib/api';
import { BookOpen, Sparkles, CheckCircle2, ChevronRight, PlayCircle } from 'lucide-react';

interface Tutorial {
  _id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  contentMarkdown: string;
}

export default function TutorialsPage(): JSX.Element {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selected, setSelected] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTutorials = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ tutorials: Tutorial[] }>('/tutorials');
      setTutorials(res.tutorials || []);
      if (res.tutorials && res.tutorials.length > 0) {
        setSelected(res.tutorials[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutorials();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-400" />
          Reseller Tutorials & Guides
        </h1>
        <p className="text-sm text-slate-400">
          Learn how to launch your store, configure custom domains, generate access codes, and customize landing pages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guides Sidebar List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Tutorial Library</h2>

          {loading ? (
            <div className="py-6 text-slate-400 text-sm">Loading guides...</div>
          ) : (
            tutorials.map((t) => {
              const isSelected = selected?._id === t._id;
              return (
                <div
                  key={t._id}
                  onClick={() => setSelected(t)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold uppercase text-indigo-400 mb-1">
                    <span>{t.category.replace('_', ' ')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-semibold text-sm">{t.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.description}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Guide Details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{selected.category.replace('_', ' ')} Guide</span>
              </div>

              <h2 className="text-2xl font-bold text-white">{selected.title}</h2>
              <p className="text-sm text-slate-400">{selected.description}</p>

              <div className="border-t border-slate-800 pt-4 text-slate-200 space-y-3 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                {selected.contentMarkdown}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">Select a tutorial from the left menu.</div>
          )}
        </div>
      </div>
    </div>
  );
}
