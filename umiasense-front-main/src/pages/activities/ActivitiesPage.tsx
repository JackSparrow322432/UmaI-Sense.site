import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { activitiesApi, childrenApi } from '../../api';
import type { Activity, ActivityCategory, Child } from '../../types';
import { useAuthStore } from '../../store/authStore';

// ─── Config ──────────────────────────────────────────────────────────────────

const CATEGORIES: Record<ActivityCategory, { label: string; color: string; bg: string; light: string }> = {
  hobby:    { label: 'Хобби',       color: '#E07628', bg: '#FFF3EA', light: '#FFF8F2' },
  therapy:  { label: 'Терапия',     color: '#2DD4A1', bg: '#EDFAF5', light: '#F0FDF9' },
  study:    { label: 'Учёба',       color: '#60A5FA', bg: '#EFF6FF', light: '#F0F9FF' },
  walk:     { label: 'Прогулка',    color: '#34D399', bg: '#ECFDF5', light: '#F0FDF4' },
  social:   { label: 'Социальное',  color: '#F59B56', bg: '#FFF7ED', light: '#FFFBF5' },
  other:    { label: 'Другое',      color: '#9CA3AF', bg: '#F3F4F6', light: '#F9FAFB' },
};

const ALL_CATEGORIES = Object.entries(CATEGORIES) as [ActivityCategory, typeof CATEGORIES[ActivityCategory]][];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDuration = (min: number) => {
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
};

const toDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const formatDateLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (toDateKey(d) === toDateKey(today)) return 'Сегодня';
  if (toDateKey(d) === toDateKey(yesterday)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// ─── Icons ───────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

// ─── Add Form ─────────────────────────────────────────────────────────────────

interface AddFormProps { childId: string; onClose: () => void; onSaved: () => void; }

function AddActivityForm({ childId, onClose, onSaved }: AddFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const inputClass = 'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Введите название'); return; }
    if (!category) { toast.error('Выберите категорию'); return; }
    setSaving(true);
    try {
      await activitiesApi.add(childId, {
        name: name.trim(),
        category,
        date,
        duration: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Активность добавлена');
      onSaved();
      onClose();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Новая активность</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Name */}
          <div>
            <label className={labelClass}>Название <span className="text-[#E07628]">*</span></label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Например: рисование, логопед, прогулка" autoFocus
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Категория <span className="text-[#E07628]">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_CATEGORIES.map(([key, cfg]) => {
                const selected = category === key;
                return (
                  <button
                    key={key} type="button" onClick={() => setCategory(key)}
                    className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      selected
                        ? 'border-current'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-gray-50'
                    }`}
                    style={selected ? { borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color } : {}}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Длительность (мин)</label>
              <input
                type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                placeholder="60" min="1" max="480"
                className={inputClass}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Заметки <span className="text-gray-300 normal-case font-normal tracking-normal">— необязательно</span></label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Как прошло занятие? Что получилось?"
              rows={3}
              className={inputClass + ' resize-none'}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
              Отмена
            </button>
            <button onClick={handleSave} disabled={saving || !name.trim() || !category}
              className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 shadow-sm">
              {saving ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ activity, currentUserId, onDelete }: {
  activity: Activity;
  currentUserId: string;
  onDelete: (id: string) => void;
}) {
  const cfg = CATEGORIES[activity.category];
  const recordedById = typeof activity.recordedBy === 'string' ? activity.recordedBy : activity.recordedBy._id;
  const isOwn = recordedById === currentUserId;
  const authorName = typeof activity.recordedBy === 'string' ? '' : activity.recordedBy.name;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
      <div className="flex">
        {/* Color bar */}
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: cfg.color }} />

        <div className="flex-1 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Name */}
              <p className="font-semibold text-gray-900 text-sm leading-tight">{activity.name}</p>

              {/* Meta row */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>

                {activity.duration && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <ClockIcon />
                    {formatDuration(activity.duration)}
                  </span>
                )}
              </div>

              {/* Notes */}
              {activity.notes && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{activity.notes}</p>
              )}

              {/* Author + time */}
              <p className="text-[11px] text-gray-400 mt-2">
                {authorName || 'Неизвестно'} · {formatTime(activity.createdAt)}
              </p>
            </div>

            {/* Delete */}
            {isOwn && (
              <button
                onClick={() => onDelete(activity._id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [child, setChild] = useState<Child | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActivityCategory | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = async () => {
    if (!childId) return;
    try {
      const [childRes, actRes] = await Promise.all([
        childrenApi.getOne(childId),
        activitiesApi.getAll(childId),
      ]);
      setChild(childRes.data);
      setActivities(actRes.data);
    } catch {
      toast.error('Ошибка загрузки');
      navigate('/children');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [childId]);

  const handleDelete = async (activityId: string) => {
    if (!childId || !confirm('Удалить запись?')) return;
    try {
      await activitiesApi.delete(childId, activityId);
      setActivities((prev) => prev.filter((a) => a._id !== activityId));
      toast.success('Запись удалена');
    } catch { toast.error('Ошибка удаления'); }
  };

  // Filter + group by date
  const grouped = useMemo(() => {
    const filtered = activeFilter === 'all'
      ? activities
      : activities.filter((a) => a.category === activeFilter);

    const map: Record<string, Activity[]> = {};
    filtered.forEach((a) => {
      const key = toDateKey(new Date(a.date));
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });

    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, items]) => ({
        label: formatDateLabel(items[0].date),
        items,
      }));
  }, [activities, activeFilter]);

  const totalCount = activeFilter === 'all' ? activities.length : activities.filter(a => a.category === activeFilter).length;

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
          <BackIcon />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Активности</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {child?.name} · {totalCount} {totalCount === 1 ? 'запись' : totalCount < 5 ? 'записи' : 'записей'}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-[#E07628] hover:bg-[#C4641A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
        >
          <PlusIcon /> Добавить
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
            activeFilter === 'all'
              ? 'bg-gray-900 border-gray-900 text-white'
              : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
          }`}
        >
          Все
        </button>
        {ALL_CATEGORIES.map(([key, cfg]) => {
          const active = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                active ? 'border-current' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
              }`}
              style={active ? { borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color } : {}}
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              {activeFilter === 'all' ? 'Активности не записаны' : `Нет активностей в категории «${CATEGORIES[activeFilter].label}»`}
            </h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {activeFilter === 'all'
                ? 'Фиксируйте занятия, прогулки и терапию, чтобы отслеживать прогресс'
                : 'Попробуйте выбрать другую категорию или добавьте первую запись'}
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
          {group.items.map((activity) => (
            <ActivityCard
              key={activity._id}
              activity={activity}
              currentUserId={user!._id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ))}

      {/* Add form modal */}
      {showAdd && childId && (
        <AddActivityForm
          childId={childId}
          onClose={() => setShowAdd(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
