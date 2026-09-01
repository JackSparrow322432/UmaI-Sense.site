import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { emotionsApi, childrenApi } from '../../api';
import type { Emotion, MoodType, Child } from '../../types';
import { useAuthStore } from '../../store/authStore';

// ─── Mood config ──────────────────────────────────────────────────────────────
const MOODS: Record<MoodType, { label: string; icon: string; color: string; bg: string }> = {
  calm:        { label: 'Спокойный',     icon: '😌', color: '#60A5FA', bg: '#EFF6FF' },
  happy:       { label: 'Радостный',     icon: '😊', color: '#FBBF24', bg: '#FFFBEB' },
  anxious:     { label: 'Тревожный',     icon: '😰', color: '#FB923C', bg: '#FFF7ED' },
  overwhelmed: { label: 'Перегруженный', icon: '😤', color: '#F87171', bg: '#FEF2F2' },
  sad:         { label: 'Грустный',      icon: '😢', color: '#A78BFA', bg: '#F5F3FF' },
  angry:       { label: 'Злой',          icon: '😠', color: '#EF4444', bg: '#FFF1F2' },
  excited:     { label: 'Возбуждённый',  icon: '🤩', color: '#2DD4A1', bg: '#EDFAF5' },
};

const MOOD_KEYS = Object.keys(MOODS) as MoodType[];

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const formatDateHeader = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (toDateKey(d) === toDateKey(today)) return 'Сегодня';
  if (toDateKey(d) === toDateKey(yesterday)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

// ─── Add form ─────────────────────────────────────────────────────────────────
interface AddFormProps {
  childId: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddEmotionForm({ childId, onClose, onSaved }: AddFormProps) {
  const [mood, setMood] = useState<MoodType | null>(null);
  const [intensity, setIntensity] = useState<number>(3);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mood) { toast.error('Выберите настроение'); return; }
    setSaving(true);
    try {
      await emotionsApi.add(childId, { mood, intensity, comment: comment.trim() || undefined });
      toast.success('Запись добавлена');
      onSaved();
      onClose();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Как себя чувствует ребёнок?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Mood selector */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Настроение</p>
          <div className="grid grid-cols-4 gap-2">
            {MOOD_KEYS.map((m) => {
              const cfg = MOODS[m];
              const selected = mood === m;
              return (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2.5 transition border-2 ${
                    selected
                      ? 'border-current'
                      : 'border-transparent bg-gray-50 hover:bg-gray-100'
                  }`}
                  style={selected ? { borderColor: cfg.color, backgroundColor: cfg.bg } : {}}
                >
                  <span className="text-2xl">{cfg.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 leading-tight text-center">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensity */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Интенсивность — <span className="text-gray-700 normal-case font-semibold">{intensity} / 5</span>
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setIntensity(n)}
                className={`flex-1 h-10 rounded-xl font-bold text-sm transition border-2 ${
                  intensity >= n
                    ? 'bg-[#E07628] border-[#E07628] text-white'
                    : 'border-gray-200 text-gray-400 hover:border-[#E07628]/40'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Комментарий</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Что произошло? (необязательно)"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !mood}
          className="w-full bg-[#E07628] text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-[#C4641A] transition disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
interface CalendarProps {
  emotions: Emotion[];
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onDayClick: (day: number) => void;
  selectedDay: number | null;
}

function EmotionCalendar({ emotions, year, month, onPrev, onNext, onDayClick, selectedDay }: CalendarProps) {
  const moodByDay = useMemo(() => {
    const map: Record<string, MoodType> = {};
    [...emotions].reverse().forEach((e) => {
      const d = new Date(e.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map[d.getDate()] = e.mood;
      }
    });
    return map;
  }, [emotions, year, month]);

  const days = useMemo(() => {
    const cells: (number | null)[] = [];
    const firstDow = new Date(year, month, 1).getDay();
    const leading = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < leading; i++) cells.push(null);
    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) cells.push(i);
    return cells;
  }, [year, month]);

  const today = new Date();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">‹</button>
        <p className="font-semibold text-gray-900">{MONTHS_RU[month]} {year}</p>
        <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_RU.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const mood = moodByDay[day];
          const cfg = mood ? MOODS[mood] : null;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => onDayClick(day)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center transition border-2 ${
                isSelected
                  ? 'border-[#E07628] ring-2 ring-[#E07628]/20'
                  : 'border-transparent'
              }`}
              style={cfg ? { backgroundColor: cfg.bg } : {}}
            >
              <span className={`text-xs font-semibold ${isToday ? 'text-[#E07628]' : 'text-gray-700'}`}>{day}</span>
              {cfg && <span className="text-sm leading-none">{cfg.icon}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Emotion card ──────────────────────────────────────────────────────────────
function EmotionCard({ emotion, currentUserId, onDelete }: { emotion: Emotion; currentUserId: string; onDelete: (id: string) => void }) {
  const cfg = MOODS[emotion.mood];
  const recordedById = typeof emotion.recordedBy === 'string' ? emotion.recordedBy : emotion.recordedBy._id;
  const isOwn = recordedById === currentUserId;

  return (
    <div
      className="flex items-start gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ backgroundColor: cfg.bg }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{cfg.label}</span>
          <span className="flex gap-0.5">
            {[1,2,3,4,5].map((n) => (
              <span
                key={n}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: n <= emotion.intensity ? cfg.color : '#E5E7EB' }}
              />
            ))}
          </span>
        </div>
        {emotion.comment && (
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{emotion.comment}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-gray-400">
            {(emotion.recordedBy as any)?.name || 'Неизвестно'} · {formatTime(emotion.createdAt)}
          </span>
        </div>
      </div>
      {isOwn && (
        <button
          onClick={() => onDelete(emotion._id)}
          className="text-gray-300 hover:text-red-400 transition text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmotionsPage() {
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [child, setChild] = useState<Child | null>(null);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'feed' | 'calendar'>('feed');
  const [showAdd, setShowAdd] = useState(false);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchData = async () => {
    if (!childId) return;
    try {
      const [childRes, emotionsRes] = await Promise.all([
        childrenApi.getOne(childId),
        emotionsApi.getAll(childId),
      ]);
      setChild(childRes.data);
      setEmotions(emotionsRes.data);
    } catch {
      toast.error('Ошибка загрузки');
      navigate('/children');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [childId]);

  const handleDelete = async (emotionId: string) => {
    if (!childId || !confirm('Удалить запись?')) return;
    try {
      await emotionsApi.delete(childId, emotionId);
      setEmotions((prev) => prev.filter((e) => e._id !== emotionId));
      toast.success('Запись удалена');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
    setSelectedDay(null);
  };

  // Group feed by date
  const grouped = useMemo(() => {
    const groups: { dateKey: string; label: string; items: Emotion[] }[] = [];
    const map: Record<string, Emotion[]> = {};
    emotions.forEach((e) => {
      const key = toDateKey(new Date(e.createdAt));
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    Object.entries(map).forEach(([, items]) => {
      groups.push({ dateKey: items[0].createdAt, label: formatDateHeader(items[0].createdAt), items });
    });
    return groups;
  }, [emotions]);

  // Calendar filtered emotions
  const calendarEmotions = useMemo(() => {
    if (!selectedDay) return [];
    return emotions.filter((e) => {
      const d = new Date(e.createdAt);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === selectedDay;
    });
  }, [emotions, selectedDay, calYear, calMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/children/${childId}`)} className="text-gray-400 hover:text-gray-600 transition text-sm">
          ← {child?.name}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Эмоции</h1>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setView('feed')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'feed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Лента
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Календарь
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="space-y-4">
          <EmotionCalendar
            emotions={emotions}
            year={calYear}
            month={calMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            onDayClick={(d) => setSelectedDay((prev) => prev === d ? null : d)}
            selectedDay={selectedDay}
          />

          {selectedDay && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-500">
                {selectedDay} {MONTHS_RU[calMonth].toLowerCase()}
              </p>
              {calendarEmotions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Записей нет</p>
              ) : (
                calendarEmotions.map((e) => (
                  <EmotionCard key={e._id} emotion={e} currentUserId={user!._id} onDelete={handleDelete} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Feed view */}
      {view === 'feed' && (
        <div className="space-y-5">
          {grouped.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-5xl mb-4">😌</p>
              <p className="font-semibold text-gray-600 mb-1">Записей пока нет</p>
              <p className="text-sm">Нажмите «+» чтобы добавить первую</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{group.label}</p>
                {group.items.map((e) => (
                  <EmotionCard key={e._id} emotion={e} currentUserId={user!._id} onDelete={handleDelete} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#E07628] text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-[#C4641A] transition hover:scale-105 z-40"
      >
        +
      </button>

      {/* Add form modal */}
      {showAdd && childId && (
        <AddEmotionForm
          childId={childId}
          onClose={() => setShowAdd(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
