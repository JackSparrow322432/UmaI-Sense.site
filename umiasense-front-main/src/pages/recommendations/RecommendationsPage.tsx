import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { recommendationsApi, childrenApi } from '../../api';
import type { Recommendation, Child } from '../../types';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'calmingTechniques' as const,
    label: 'Техники успокоения',
    color: '#60A5FA',
    bg: '#EFF6FF',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  {
    key: 'activitiesForToday' as const,
    label: 'Активности на сегодня',
    color: '#E07628',
    bg: '#FFF3EA',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'communicationTips' as const,
    label: 'Советы по коммуникации',
    color: '#2DD4A1',
    bg: '#EDFAF5',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    key: 'attentionPoints' as const,
    label: 'На что обратить внимание',
    color: '#A78BFA',
    bg: '#F5F3FF',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

// ─── Recommendation card (full view) ─────────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="space-y-3">
      {CATEGORIES.map((cat) => {
        const items: string[] = rec.content[cat.key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={cat.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.bg, color: cat.color }}>
                {cat.icon}
              </div>
              <h3 className="text-sm font-semibold text-gray-800">{cat.label}</h3>
            </div>
            <ul className="px-4 py-3 space-y-2.5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold" style={{ backgroundColor: cat.bg, color: cat.color }}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── History item (collapsed row) ────────────────────────────────────────────

function HistoryItem({ rec, onExpand }: { rec: Recommendation; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition text-left"
    >
      <div className="w-8 h-8 rounded-xl bg-[#FFF3EA] flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">Рекомендации ИИ</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{formatDateShort(rec.generatedAt)}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [child, setChild]                   = useState<Child | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading]               = useState(true);
  const [generating, setGenerating]         = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const fetchData = async () => {
    if (!childId) return;
    try {
      const [cRes, rRes] = await Promise.all([
        childrenApi.getOne(childId),
        recommendationsApi.getAll(childId),
      ]);
      setChild(cRes.data);
      setRecommendations(rRes.data);
    } catch {
      toast.error('Ошибка загрузки');
      navigate('/children');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [childId]);

  const handleGenerate = async () => {
    if (!childId || generating) return;
    setGenerating(true);
    try {
      const { data } = await recommendationsApi.generate(childId);
      setRecommendations((prev) => [data, ...prev]);
      toast.success('Рекомендации готовы');
    } catch {
      toast.error('Не удалось сгенерировать рекомендации');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const latest = recommendations[0] ?? null;
  const history = recommendations.slice(1);
  const historyExpanded = history.find((r) => r._id === expandedHistory) ?? null;

  return (
    <div className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/children/${childId}`)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">ИИ Рекомендации</h1>
          <p className="text-xs text-gray-400 mt-0.5">{child?.name}</p>
        </div>
      </div>

      {/* Generate button */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        
        <div className="px-5 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF3EA] flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Персональный анализ</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              ИИ проанализирует эмоции, активности и дневник {child?.name} и даст рекомендации на сегодня
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-shrink-0 flex items-center gap-2 bg-[#E07628] hover:bg-[#C4641A] disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Анализ...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Сгенерировать
              </>
            )}
          </button>
        </div>
      </div>

      {/* Latest recommendation */}
      {latest ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">Последние рекомендации</p>
            <p className="text-[11px] text-gray-400">{formatDate(latest.generatedAt)}</p>
          </div>
          <RecommendationCard rec={latest} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFF3EA] mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Рекомендаций пока нет</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Нажмите «Сгенерировать» — ИИ проанализирует данные за последнюю неделю и составит советы
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-3">История</p>

          {/* Expanded history item */}
          {historyExpanded && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600">{formatDate(historyExpanded.generatedAt)}</p>
                <button
                  onClick={() => setExpandedHistory(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition font-medium"
                >
                  Свернуть
                </button>
              </div>
              <RecommendationCard rec={historyExpanded} />
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {history.map((rec) => (
              expandedHistory === rec._id ? null : (
                <HistoryItem
                  key={rec._id}
                  rec={rec}
                  onExpand={() => setExpandedHistory(rec._id)}
                />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
