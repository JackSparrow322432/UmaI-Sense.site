import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '../../api';
import type { Child, Emotion, Activity, DiaryEntry, User, MoodType, ActivityCategory, DiaryTag } from '../../types';

// ─── Configs ─────────────────────────────────────────────────────────────────

const MOODS: Record<MoodType, { label: string; icon: string; color: string; bg: string }> = {
  calm:        { label: 'Спокойный',     icon: '😌', color: '#60A5FA', bg: '#EFF6FF' },
  happy:       { label: 'Радостный',     icon: '😊', color: '#FBBF24', bg: '#FFFBEB' },
  anxious:     { label: 'Тревожный',     icon: '😰', color: '#FB923C', bg: '#FFF7ED' },
  overwhelmed: { label: 'Перегруженный', icon: '😤', color: '#F87171', bg: '#FEF2F2' },
  sad:         { label: 'Грустный',      icon: '😢', color: '#A78BFA', bg: '#F5F3FF' },
  angry:       { label: 'Злой',          icon: '😠', color: '#EF4444', bg: '#FFF1F2' },
  excited:     { label: 'Возбуждённый',  icon: '🤩', color: '#2DD4A1', bg: '#EDFAF5' },
};

const ACTIVITY_CFG: Record<ActivityCategory, { label: string; color: string; bg: string }> = {
  hobby:   { label: 'Хобби',      color: '#E07628', bg: '#FFF3EA' },
  therapy: { label: 'Терапия',    color: '#2DD4A1', bg: '#EDFAF5' },
  study:   { label: 'Учёба',      color: '#60A5FA', bg: '#EFF6FF' },
  walk:    { label: 'Прогулка',   color: '#34D399', bg: '#ECFDF5' },
  social:  { label: 'Социальное', color: '#F59B56', bg: '#FFF7ED' },
  other:   { label: 'Другое',     color: '#9CA3AF', bg: '#F3F4F6' },
};

const DIARY_CFG: Record<DiaryTag, { label: string; color: string; bg: string }> = {
  trigger:  { label: 'Триггер',    color: '#EF4444', bg: '#FEF2F2' },
  mood:     { label: 'Настроение', color: '#60A5FA', bg: '#EFF6FF' },
  info:     { label: 'Заметка',    color: '#9CA3AF', bg: '#F3F4F6' },
  progress: { label: 'Прогресс',   color: '#2DD4A1', bg: '#EDFAF5' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAge = (dob: string) => {
  const d = new Date(dob), now = new Date();
  const y = now.getFullYear() - d.getFullYear() -
    (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  const n = y % 10, h = y % 100;
  if (h >= 11 && h <= 19) return `${y} лет`;
  if (n === 1) return `${y} год`;
  if (n >= 2 && n <= 4) return `${y} года`;
  return `${y} лет`;
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'вчера';
  return `${days} дн назад`;
};

const formatDuration = (min: number) => {
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
};

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ text, count }: { text: string; count?: number }) {
  return (
    <p className="text-xs font-medium text-gray-500 mb-3">
      {text}{count !== undefined ? ` · ${count}` : ''}
    </p>
  );
}

// ─── Tag pill ────────────────────────────────────────────────────────────────

function Tag({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type AdminChild = Child & {
  parentId: Pick<User, '_id' | 'name' | 'email'>;
  trainers: Pick<User, '_id' | 'name' | 'email'>[];
};

export default function AdminChildDetailPage() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();

  const [child,      setChild]      = useState<AdminChild | null>(null);
  const [emotions,   setEmotions]   = useState<Emotion[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [diary,      setDiary]      = useState<DiaryEntry[]>([]);
  const [stats,      setStats]      = useState({ totalEmotions: 0, totalActivities: 0, totalDiary: 0 });
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!childId) return;
    adminApi.getChildDetail(childId)
      .then(({ data }) => {
        setChild(data.child as AdminChild);
        setEmotions(data.emotions);
        setActivities(data.activities);
        setDiary(data.diary);
        setStats(data.stats);
      })
      .catch(() => {
        toast.error('Ошибка загрузки');
        navigate(-1);
      })
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!child) return null;

  return (
    <div className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Профиль ребёнка</h1>
      </div>

      {/* Child card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        
        <div className="p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF3EA] flex items-center justify-center text-2xl font-bold text-[#E07628] flex-shrink-0 overflow-hidden">
            {child.photo
              ? <img src={child.photo} className="w-full h-full object-cover" alt="" />
              : child.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">{child.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{getAge(child.dateOfBirth)}</p>
            {child.diagnosis && (
              <span className="inline-block mt-1.5 text-xs bg-[#FFF3EA] text-[#E07628] px-2 py-0.5 rounded-full font-semibold">
                {child.diagnosis}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '😊', label: 'Эмоций',     value: stats.totalEmotions,   color: '#60A5FA', bg: '#EFF6FF' },
          { icon: '🏃', label: 'Активностей', value: stats.totalActivities, color: '#E07628', bg: '#FFF3EA' },
          { icon: '📓', label: 'Записей',     value: stats.totalDiary,      color: '#2DD4A1', bg: '#EDFAF5' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: s.bg }}>{s.icon}</div>
            <span className="text-xl font-bold text-gray-900">{s.value}</span>
            <span className="text-[10px] text-gray-400 text-center">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Profile info */}
      {(child.communicationMethod || child.triggers?.length || child.interests?.length || child.fears?.length || child.calmingActivities?.length) && (
        <div>
          <SectionLabel text="Профиль" />
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {[
              { label: 'Коммуникация', value: child.communicationMethod },
              { label: 'Триггеры',     value: child.triggers?.join(', ') },
              { label: 'Страхи',       value: child.fears?.join(', ') },
              { label: 'Интересы',     value: child.interests?.join(', ') },
              { label: 'Успокоение',   value: child.calmingActivities?.join(', ') },
            ].filter((r) => r.value).map((row) => (
              <div key={row.label} className="px-4 py-3 flex items-start gap-3">
                <span className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{row.label}</span>
                <span className="text-xs text-gray-700 leading-relaxed">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parent + trainers */}
      <div>
        <SectionLabel text="Участники" />
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {/* Parent */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] flex items-center justify-center text-sm font-bold text-[#E07628] flex-shrink-0">
              {(child.parentId as any)?.name?.[0] ?? 'Р'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{(child.parentId as any)?.name ?? '—'}</p>
              <p className="text-xs text-gray-400">{(child.parentId as any)?.email}</p>
            </div>
            <Tag label="Родитель" bg="#FFF3EA" color="#E07628" />
          </div>
          {/* Trainers */}
          {(child.trainers as any[]).length === 0 ? (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400">Тренеров нет</p>
            </div>
          ) : (
            (child.trainers as any[]).map((t: any) => (
              <div key={t._id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-sm font-bold text-[#60A5FA] flex-shrink-0">
                  {t.name?.[0] ?? 'Т'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.email}</p>
                </div>
                <Tag label="Тренер" bg="#EFF6FF" color="#60A5FA" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent emotions */}
      {emotions.length > 0 && (
        <div>
          <SectionLabel text="Последние эмоции" count={emotions.length} />
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {emotions.map((e) => (
              <div key={e._id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: MOODS[e.mood].bg }}>
                  {MOODS[e.mood].icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{MOODS[e.mood].label}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: n <= e.intensity ? MOODS[e.mood].color : '#E5E7EB' }} />
                      ))}
                    </div>
                  </div>
                  {e.comment && <p className="text-xs text-gray-500 mt-0.5 truncate">{e.comment}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {(e.recordedBy as any)?.name ?? '—'} · {timeAgo(e.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activities */}
      {activities.length > 0 && (
        <div>
          <SectionLabel text="Последние активности" count={activities.length} />
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {activities.map((a) => (
              <div key={a._id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ACTIVITY_CFG[a.category].bg }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACTIVITY_CFG[a.category].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{a.name}</span>
                    <Tag label={ACTIVITY_CFG[a.category].label} bg={ACTIVITY_CFG[a.category].bg} color={ACTIVITY_CFG[a.category].color} />
                    {a.duration && <span className="text-[10px] text-gray-400">{formatDuration(a.duration)}</span>}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {(a.recordedBy as any)?.name ?? '—'} · {timeAgo(a.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent diary */}
      {diary.length > 0 && (
        <div>
          <SectionLabel text="Последние записи дневника" count={diary.length} />
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {diary.map((d) => (
              <div key={d._id} className="px-4 py-3.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: DIARY_CFG[d.tag].bg }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DIARY_CFG[d.tag].color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <Tag label={DIARY_CFG[d.tag].label} bg={DIARY_CFG[d.tag].bg} color={DIARY_CFG[d.tag].color} />
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">{d.text}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {(d.author as any)?.name ?? '—'} · {timeAgo(d.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
