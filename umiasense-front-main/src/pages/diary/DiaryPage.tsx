import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { diaryApi, childrenApi } from '../../api';
import type { DiaryEntry, DiaryTag, Child } from '../../types';
import { useAuthStore } from '../../store/authStore';
import AddDiaryModal from '../../components/modals/AddDiaryModal';

// ─── Config ──────────────────────────────────────────────────────────────────

const TAGS: Record<DiaryTag, { label: string; color: string; bg: string }> = {
  trigger:  { label: 'Триггер',    color: '#EF4444', bg: '#FEF2F2' },
  mood:     { label: 'Настроение', color: '#60A5FA', bg: '#EFF6FF' },
  info:     { label: 'Заметка',    color: '#9CA3AF', bg: '#F3F4F6' },
  progress: { label: 'Прогресс',   color: '#2DD4A1', bg: '#EDFAF5' },
};

const TAG_KEYS = Object.keys(TAGS) as DiaryTag[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const formatDateLabel = (iso: string) => {
  const d = new Date(iso), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (toKey(d) === toKey(today)) return 'Сегодня';
  if (toKey(d) === toKey(yesterday)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// ─── Entry card ───────────────────────────────────────────────────────────────

function DiaryCard({ entry, currentUserId, onDelete }: {
  entry: DiaryEntry;
  currentUserId: string;
  onDelete: (id: string) => void;
}) {
  const cfg = TAGS[entry.tag];
  const authorId = typeof entry.author === 'string' ? entry.author : entry.author._id;
  const authorName = typeof entry.author === 'string' ? '' : entry.author.name;
  const isOwn = authorId === currentUserId;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
      <div className="flex">
        {/* Color bar */}
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: cfg.color }} />

        <div className="flex-1 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Tag + time */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <span className="text-[10px] text-gray-400">{formatTime(entry.createdAt)}</span>
              </div>

              {/* Text */}
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{entry.text}</p>

              {/* Author */}
              <p className="text-[10px] text-gray-400 mt-2">
                {authorName || 'Неизвестно'}
              </p>
            </div>

            {/* Delete */}
            {isOwn && (
              <button
                onClick={() => onDelete(entry._id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiaryPage() {
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [child, setChild] = useState<Child | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DiaryTag | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = async () => {
    if (!childId) return;
    try {
      const [cRes, dRes] = await Promise.all([
        childrenApi.getOne(childId),
        diaryApi.getAll(childId),
      ]);
      setChild(cRes.data);
      setEntries(dRes.data);
    } catch {
      toast.error('Ошибка загрузки');
      navigate('/children');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [childId]);

  const handleDelete = async (entryId: string) => {
    if (!childId || !confirm('Удалить запись?')) return;
    try {
      await diaryApi.delete(childId, entryId);
      setEntries((prev) => prev.filter((e) => e._id !== entryId));
      toast.success('Запись удалена');
    } catch { toast.error('Ошибка удаления'); }
  };

  // Filter + group by date
  const grouped = useMemo(() => {
    const filtered = filter === 'all' ? entries : entries.filter((e) => e.tag === filter);
    const map: Record<string, DiaryEntry[]> = {};
    filtered.forEach((e) => {
      const key = toKey(new Date(e.createdAt));
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, items]) => ({ label: formatDateLabel(items[0].createdAt), items }));
  }, [entries, filter]);

  const totalCount = filter === 'all' ? entries.length : entries.filter((e) => e.tag === filter).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <h1 className="text-lg font-bold text-gray-900">Дневник наблюдений</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {child?.name} · {totalCount} {totalCount === 1 ? 'запись' : totalCount < 5 ? 'записи' : 'записей'}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-[#E07628] hover:bg-[#C4641A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Добавить
        </button>
      </div>

      {/* Tag filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
            filter === 'all'
              ? 'bg-gray-900 border-gray-900 text-white'
              : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
          }`}
        >
          Все
        </button>
        {TAG_KEYS.map((key) => {
          const cfg = TAGS[key];
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
              style={active
                ? { borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color }
                : { borderColor: '#E5E7EB', color: '#6B7280', backgroundColor: '#FFFFFF' }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          
          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFF3EA] mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              {filter === 'all' ? 'Дневник пуст' : `Нет записей с тегом «${TAGS[filter as DiaryTag].label}»`}
            </h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {filter === 'all'
                ? 'Фиксируйте наблюдения, прогресс и важные моменты'
                : 'Выберите другой тег или добавьте новую запись'}
            </p>
          </div>
        </div>
      )}

      {/* Feed */}
      {grouped.map((group) => (
        <div key={group.label} className="space-y-2.5">
          <p className="text-xs font-medium text-gray-500 px-1">
            {group.label}
          </p>
          {group.items.map((entry) => (
            <DiaryCard
              key={entry._id}
              entry={entry}
              currentUserId={user!._id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ))}

      {/* Add modal */}
      {showAdd && childId && (
        <AddDiaryModal
          childId={childId}
          onClose={() => setShowAdd(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
