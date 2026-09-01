import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi, emotionsApi, activitiesApi, diaryApi, notificationsApi } from '../../api';
import type { Child, Emotion, Activity, DiaryEntry, Notification, MoodType, ActivityCategory, DiaryTag } from '../../types';
import { useAuthStore } from '../../store/authStore';
import AddEmotionModal from '../../components/modals/AddEmotionModal';
import AddActivityModal from '../../components/modals/AddActivityModal';
import AddDiaryModal from '../../components/modals/AddDiaryModal';
import ModalShell from '../../components/modals/ModalShell';

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

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6)  return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
};

const getDateLabel = () => {
  const s = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ChildData = { emotions: Emotion[]; activities: Activity[]; diary: DiaryEntry[] };

type FeedItem =
  | { kind: 'emotion';  child: Child; date: string; data: Emotion }
  | { kind: 'activity'; child: Child; date: string; data: Activity }
  | { kind: 'diary';    child: Child; date: string; data: DiaryEntry };

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuthStore();

  const [children, setChildren]     = useState<Child[]>([]);
  const [childData, setChildData]   = useState<Record<string, ChildData>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]       = useState(true);

  // Quick-add flow
  const [qaOpen,  setQaOpen]  = useState(false);
  const [qaChild, setQaChild] = useState<Child | null>(null);
  const [qaModal, setQaModal] = useState<'emotion' | 'activity' | 'diary' | null>(null);

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    try {
      const [childrenRes, notifRes] = await Promise.all([
        childrenApi.getAll(),
        notificationsApi.getAll(),
      ]);
      const kids = childrenRes.data;
      setChildren(kids);
      setNotifications(notifRes.data);

      if (kids.length > 0) {
        const results = await Promise.all(
          kids.map((child) =>
            Promise.all([
              emotionsApi.getAll(child._id),
              activitiesApi.getAll(child._id),
              diaryApi.getAll(child._id),
            ]).then(([e, a, d]) => ({
              childId: child._id,
              emotions: e.data,
              activities: a.data,
              diary: d.data,
            }))
          )
        );
        const map: Record<string, ChildData> = {};
        results.forEach((r) => {
          map[r.childId] = { emotions: r.emotions, activities: r.activities, diary: r.diary };
        });
        setChildData(map);
      }
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── Derived data ────────────────────────────────────────────────────────

  const unreadNotifs = useMemo(() => notifications.filter((n) => !n.read), [notifications]);

  const todayStats = useMemo(() => {
    let emotions = 0, activities = 0, diary = 0;
    children.forEach((child) => {
      const d = childData[child._id];
      if (!d) return;
      emotions   += d.emotions.filter((e)  => isToday(e.createdAt)).length;
      activities += d.activities.filter((a) => isToday(a.date)).length;
      diary      += d.diary.filter((de)    => isToday(de.createdAt)).length;
    });
    return { emotions, activities, diary };
  }, [children, childData]);

  const feed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    children.forEach((child) => {
      const d = childData[child._id];
      if (!d) return;
      d.emotions.forEach((e)  => items.push({ kind: 'emotion',  child, date: e.createdAt, data: e }));
      d.activities.forEach((a) => items.push({ kind: 'activity', child, date: a.date,      data: a }));
      d.diary.forEach((de)     => items.push({ kind: 'diary',    child, date: de.createdAt, data: de }));
    });
    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [children, childData]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleDismissNotifs = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* silent */ }
  };

  const handleQuickAdd = () => {
    if (children.length === 0) return;
    if (children.length === 1) setQaChild(children[0]);
    setQaOpen(true);
  };

  const handleQaSaved = () => {
    fetchAll();
    setQaModal(null);
    setQaChild(null);
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasToday = (todayStats.emotions + todayStats.activities + todayStats.diary) > 0;

  return (
    <div className="space-y-6 pb-24">

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">{getDateLabel()}</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-0.5">
            {getGreeting()}, {user?.name.split(' ')[0]}
          </h1>
        </div>
        <Link
          to="/notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors text-gray-400 hover:text-gray-600"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadNotifs.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#E07628] text-white text-[9px] font-semibold rounded-full flex items-center justify-center px-1">
              {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
            </span>
          )}
        </Link>
      </div>

      {/* ── Notifications banner ─────────────────────────────────────────── */}
      {unreadNotifs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#E07628] rounded-full" />
              <p className="text-sm font-medium text-gray-900">
                {unreadNotifs.length}{' '}
                {unreadNotifs.length === 1 ? 'новое уведомление' : unreadNotifs.length < 5 ? 'новых уведомления' : 'новых уведомлений'}
              </p>
            </div>
            <button
              onClick={handleDismissNotifs}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              Прочитать всё
            </button>
          </div>
          <div className="space-y-3">
            {unreadNotifs.slice(0, 2).map((n) => (
              <div key={n._id} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {unreadNotifs.length > 2 && (
            <Link
              to="/notifications"
              className="block mt-3 text-xs text-[#E07628] font-medium hover:text-[#c96a21] transition-colors"
            >
              Ещё {unreadNotifs.length - 2} уведомлений →
            </Link>
          )}
        </div>
      )}

      {/* ── Children row ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-500">Дети</p>
          <Link
            to="/children/new"
            className="text-xs text-[#E07628] font-medium hover:text-[#c96a21] transition-colors flex items-center gap-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Добавить
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {children.length === 0 ? (
            <Link
              to="/children/new"
              className="flex-shrink-0 w-32 bg-white rounded-xl border-2 border-dashed border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-300 transition-colors text-center"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-xs text-gray-400 leading-tight">Добавить ребёнка</p>
            </Link>
          ) : (
            children.map((child) => {
              const mood = childData[child._id]?.emotions.find((e) => isToday(e.createdAt));
              return (
                <Link
                  key={child._id}
                  to={`/children/${child._id}`}
                  className="flex-shrink-0 w-32 bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2 hover:border-gray-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 overflow-hidden flex-shrink-0">
                    {child.photo
                      ? <img src={child.photo} className="w-full h-full object-cover" alt="" />
                      : child.name[0]}
                  </div>
                  <p className="text-xs font-medium text-gray-800 text-center w-full truncate">{child.name}</p>
                  {mood ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: MOODS[mood.mood].bg }}>
                      <span className="text-xs leading-none">{MOODS[mood.mood].icon}</span>
                      <span className="text-[10px] font-medium leading-none truncate" style={{ color: MOODS[mood.mood].color }}>
                        {MOODS[mood.mood].label}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center px-2 py-0.5 rounded-full border border-dashed border-gray-200">
                      <span className="text-[10px] text-gray-400">Не записано</span>
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ── Today stats ──────────────────────────────────────────────────── */}
      {children.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-3">Сегодня</p>
          {!hasToday ? (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Сегодня записей ещё нет</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '😊', label: 'Настроений',  value: todayStats.emotions,   color: '#60A5FA', bg: '#EFF6FF' },
                { icon: '🏃', label: 'Активностей', value: todayStats.activities, color: '#E07628', bg: '#FFF3EA' },
                { icon: '📓', label: 'Записей',      value: todayStats.diary,      color: '#2DD4A1', bg: '#EDFAF5' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: stat.bg }}>
                    {stat.icon}
                  </div>
                  <span className="text-lg font-semibold text-gray-900">{stat.value}</span>
                  <span className="text-xs text-gray-400 text-center leading-tight">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Recent feed ──────────────────────────────────────────────────── */}
      {children.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-3">Последние записи</p>
          {feed.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-700 mb-1">Записей пока нет</p>
              <p className="text-xs text-gray-400">Нажмите «+» чтобы добавить первую</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {feed.map((item, i) => (
                <Link
                  key={i}
                  to={
                    item.kind === 'emotion'  ? `/children/${item.child._id}/emotions` :
                    item.kind === 'activity' ? `/children/${item.child._id}/activities` :
                    `/children/${item.child._id}/diary`
                  }
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  {/* Child mini-avatar */}
                  <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0 mt-0.5 overflow-hidden">
                    {item.child.photo
                      ? <img src={item.child.photo} className="w-full h-full object-cover" alt="" />
                      : item.child.name[0]}
                  </div>

                  {/* Event icon */}
                  {item.kind === 'emotion' && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: MOODS[item.data.mood].bg }}>
                      {MOODS[item.data.mood].icon}
                    </div>
                  )}
                  {item.kind === 'activity' && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ACTIVITY_CFG[item.data.category].bg }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ACTIVITY_CFG[item.data.category].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  )}
                  {item.kind === 'diary' && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: DIARY_CFG[item.data.tag].bg }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIARY_CFG[item.data.tag].color }} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {item.kind === 'emotion' && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{MOODS[item.data.mood].label}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: n <= item.data.intensity ? MOODS[item.data.mood].color : '#E5E7EB' }} />
                            ))}
                          </div>
                        </div>
                        {item.data.comment && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.data.comment}</p>}
                      </>
                    )}
                    {item.kind === 'activity' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">{item.data.name}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ACTIVITY_CFG[item.data.category].bg, color: ACTIVITY_CFG[item.data.category].color }}>
                          {ACTIVITY_CFG[item.data.category].label}
                        </span>
                        {item.data.duration && <span className="text-xs text-gray-400">{formatDuration(item.data.duration)}</span>}
                      </div>
                    )}
                    {item.kind === 'diary' && (
                      <>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: DIARY_CFG[item.data.tag].bg, color: DIARY_CFG[item.data.tag].color }}>
                          {DIARY_CFG[item.data.tag].label}
                        </span>
                        <p className="text-sm text-gray-700 mt-0.5 line-clamp-1">{item.data.text}</p>
                      </>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      <span className="font-medium text-gray-500">{item.child.name}</span> · {timeAgo(item.date)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quick-add FAB ─────────────────────────────────────────────────── */}
      {children.length > 0 && (
        <button
          onClick={handleQuickAdd}
          className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 w-12 h-12 bg-[#E07628] hover:bg-[#c96a21] text-white rounded-xl flex items-center justify-center transition-colors z-20 shadow-lg shadow-orange-200"
          title="Добавить запись"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* ── Quick-add picker modal ────────────────────────────────────────── */}
      {qaOpen && (
        <ModalShell
          title={qaChild ? `Добавить для ${qaChild.name}` : 'Выберите ребёнка'}
          onClose={() => { setQaOpen(false); setQaChild(null); }}
        >
          {!qaChild ? (
            <div className="space-y-2">
              {children.map((child) => (
                <button
                  key={child._id}
                  onClick={() => setQaChild(child)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 overflow-hidden flex-shrink-0">
                    {child.photo ? <img src={child.photo} className="w-full h-full object-cover" alt="" /> : child.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{child.name}</p>
                    {child.diagnosis && <p className="text-xs text-gray-400">{child.diagnosis}</p>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { type: 'emotion'  as const, icon: '😊', label: 'Настроение',  sub: 'Как себя чувствует?',          color: '#60A5FA', bg: '#EFF6FF' },
                { type: 'activity' as const, icon: '🏃', label: 'Активность',  sub: 'Занятие, прогулка, терапия',   color: '#E07628', bg: '#FFF3EA' },
                { type: 'diary'    as const, icon: '📓', label: 'Дневник',     sub: 'Заметка, триггер, прогресс',   color: '#2DD4A1', bg: '#EDFAF5' },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { setQaModal(opt.type); setQaOpen(false); }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: opt.bg }}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                  </div>
                </button>
              ))}
              {children.length > 1 && (
                <button
                  onClick={() => setQaChild(null)}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 pt-1 transition-colors text-center"
                >
                  ← Выбрать другого ребёнка
                </button>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {/* ── Entry modals ─────────────────────────────────────────────────── */}
      {qaModal === 'emotion'  && qaChild && <AddEmotionModal  childId={qaChild._id} onClose={() => setQaModal(null)} onSaved={handleQaSaved} />}
      {qaModal === 'activity' && qaChild && <AddActivityModal childId={qaChild._id} onClose={() => setQaModal(null)} onSaved={handleQaSaved} />}
      {qaModal === 'diary'    && qaChild && <AddDiaryModal    childId={qaChild._id} onClose={() => setQaModal(null)} onSaved={handleQaSaved} />}
    </div>
  );
}
