import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi, emotionsApi, activitiesApi, diaryApi } from '../../api';
import type { Child, Emotion, Activity, DiaryEntry, MoodType, ActivityCategory, DiaryTag } from '../../types';
import { useAuthStore } from '../../store/authStore';
import AddEmotionModal from '../../components/modals/AddEmotionModal';
import AddDiaryModal from '../../components/modals/AddDiaryModal';
import AddActivityModal from '../../components/modals/AddActivityModal';

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

const getAge = (dob: string) => {
  const d = new Date(dob), now = new Date();
  const y = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  const n = y % 10, h = y % 100;
  if (h >= 11 && h <= 19) return `${y} лет`;
  if (n === 1) return `${y} год`;
  if (n >= 2 && n <= 4) return `${y} года`;
  return `${y} лет`;
};

const isToday = (iso: string) => {
  const d = new Date(iso), t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
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

type TLItem =
  | { kind: 'emotion';  date: string; data: Emotion }
  | { kind: 'activity'; date: string; data: Activity }
  | { kind: 'diary';    date: string; data: DiaryEntry };

export default function ChildDetailPage() {
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [child, setChild] = useState<Child | null>(null);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'emotion' | 'diary' | 'activity' | null>(null);

  const isParent = user?.role === 'parent';

  const fetchAll = async () => {
    if (!childId) return;
    try {
      const [cRes, eRes, aRes, dRes] = await Promise.all([
        childrenApi.getOne(childId),
        emotionsApi.getAll(childId),
        activitiesApi.getAll(childId),
        diaryApi.getAll(childId),
      ]);
      setChild(cRes.data);
      setEmotions(eRes.data);
      setActivities(aRes.data);
      setDiary(dRes.data);
    } catch {
      toast.error('Ошибка загрузки');
      navigate('/children');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [childId]);

  const todayEmotion = useMemo(() => emotions.find((e) => isToday(e.createdAt)), [emotions]);

  const timeline = useMemo((): TLItem[] => {
    const items: TLItem[] = [
      ...emotions.map((e) => ({ kind: 'emotion' as const, date: e.createdAt, data: e })),
      ...activities.map((a) => ({ kind: 'activity' as const, date: a.date, data: a })),
      ...diary.map((d) => ({ kind: 'diary' as const, date: d.createdAt, data: d })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }, [emotions, activities, diary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!child) return null;

  const QUICK_ACTIONS = [
    {
      key: 'emotion' as const,
      label: 'Настроение',
      sub: 'Как себя чувствует?',
      color: '#60A5FA', bg: '#EFF6FF',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
    },
    {
      key: 'diary' as const,
      label: 'Дневник',
      sub: 'Добавить заметку',
      color: '#2DD4A1', bg: '#EDFAF5',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      key: 'activity' as const,
      label: 'Активность',
      sub: 'Занятие, прогулка',
      color: '#E07628', bg: '#FFF3EA',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
  ];

  const MODULES = [
    { label: 'Дневник',    to: `/children/${childId}/diary`,            color: '#2DD4A1', bg: '#EDFAF5', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> },
    { label: 'Эмоции',     to: `/children/${childId}/emotions`,         color: '#60A5FA', bg: '#EFF6FF', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
    { label: 'Активности', to: `/children/${childId}/activities`,       color: '#E07628', bg: '#FFF3EA', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { label: 'Развитие',   to: `/children/${childId}/milestones`,       color: '#A78BFA', bg: '#F5F3FF', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    ...(isParent ? [{ label: 'ИИ Советы', to: `/children/${childId}/recommendations`, color: '#F59B56', bg: '#FFF7ED', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }] : []),
    { label: 'Профиль',    to: `/children/${childId}/profile`,          color: '#9CA3AF', bg: '#F3F4F6', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  return (
    <div className="space-y-5 pb-20">

      <button onClick={() => navigate('/children')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Все профили
      </button>

      {/* Child header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
          {child.photo ? <img src={child.photo} className="w-full h-full object-cover" alt="" /> : child.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900">{child.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {getAge(child.dateOfBirth)}
            {child.diagnosis && (
              <span className="bg-orange-50 text-[#E07628] px-2 py-0.5 rounded-full font-medium text-[10px]">
                {child.diagnosis}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Today snapshot */}
      {todayEmotion ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: MOODS[todayEmotion.mood].bg }}>
            {MOODS[todayEmotion.mood].icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Настроение сегодня</p>
            <p className="text-sm font-medium text-gray-900">{MOODS[todayEmotion.mood].label}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-0.5">{[1,2,3,4,5].map((n) => <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: n <= todayEmotion.intensity ? MOODS[todayEmotion.mood].color : '#E5E7EB' }} />)}</div>
              <span className="text-xs text-gray-400">{timeAgo(todayEmotion.createdAt)}</span>
            </div>
          </div>
          <button onClick={() => setModal('emotion')} className="text-xs text-[#E07628] font-medium hover:text-[#c96a21] transition-colors flex-shrink-0">Обновить</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">Настроение ещё не записано</p>
            <p className="text-xs text-gray-400 mt-0.5">Как сегодня себя чувствует {child.name}?</p>
          </div>
          <button onClick={() => setModal('emotion')} className="flex-shrink-0 bg-[#E07628] hover:bg-[#c96a21] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">Записать</button>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Быстрые действия</p>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.key} onClick={() => setModal(a.key)}
              className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: a.bg, color: a.color }}>{a.icon}</div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-800 leading-tight">{a.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{a.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent timeline */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Последние записи</p>
        {timeline.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">Записей пока нет</p>
            <p className="text-xs text-gray-400">Используйте быстрые действия выше</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {timeline.map((item, i) => (
              <div key={i} className="px-4 py-3.5">
                {item.kind === 'emotion' && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: MOODS[item.data.mood].bg }}>{MOODS[item.data.mood].icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{MOODS[item.data.mood].label}</span>
                        <div className="flex gap-0.5">{[1,2,3,4,5].map((n) => <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: n <= item.data.intensity ? MOODS[item.data.mood].color : '#E5E7EB' }} />)}</div>
                      </div>
                      {item.data.comment && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.data.comment}</p>}
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(item.date)}</p>
                    </div>
                  </div>
                )}
                {item.kind === 'activity' && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ACTIVITY_CFG[item.data.category].bg }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ACTIVITY_CFG[item.data.category].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">{item.data.name}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ACTIVITY_CFG[item.data.category].bg, color: ACTIVITY_CFG[item.data.category].color }}>{ACTIVITY_CFG[item.data.category].label}</span>
                        {item.data.duration && <span className="text-xs text-gray-400">{formatDuration(item.data.duration)}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(item.date)}</p>
                    </div>
                  </div>
                )}
                {item.kind === 'diary' && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: DIARY_CFG[item.data.tag].bg }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIARY_CFG[item.data.tag].color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: DIARY_CFG[item.data.tag].bg, color: DIARY_CFG[item.data.tag].color }}>{DIARY_CFG[item.data.tag].label}</span>
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2 leading-relaxed">{item.data.text}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(item.date)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Module grid */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Разделы</p>
        <div className="grid grid-cols-3 gap-3">
          {MODULES.map((m) => (
            <Link key={m.label} to={m.to}
              className="bg-white rounded-xl border border-gray-200 p-3.5 flex flex-col items-center gap-2 hover:border-gray-300 transition-colors text-center">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.bg, color: m.color }}>{m.icon}</div>
              <span className="text-xs font-medium text-gray-700 leading-tight">{m.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {modal === 'emotion'  && <AddEmotionModal  childId={childId!} onClose={() => setModal(null)} onSaved={fetchAll} />}
      {modal === 'diary'    && <AddDiaryModal    childId={childId!} onClose={() => setModal(null)} onSaved={fetchAll} />}
      {modal === 'activity' && <AddActivityModal childId={childId!} onClose={() => setModal(null)} onSaved={fetchAll} />}
    </div>
  );
}
