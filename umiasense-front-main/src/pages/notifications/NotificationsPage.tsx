import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { notificationsApi } from '../../api';
import { useNotifStore } from '../../store/notifStore';
import { useAuthStore } from '../../store/authStore';
import type { Notification, NotificationType } from '../../types';

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CFG: Record<NotificationType, { icon: React.ReactElement; color: string; bg: string }> = {
  diary_entry: {
    color: '#2DD4A1', bg: '#EDFAF5',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  invite_accepted: {
    color: '#E07628', bg: '#FFF3EA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
      </svg>
    ),
  },
  ai_recommendation: {
    color: '#F59B56', bg: '#FFF7ED',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  emotion_reminder: {
    color: '#60A5FA', bg: '#EFF6FF',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  new_article: {
    color: '#E07628', bg: '#FFF3EA',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [markingAll,    setMarkingAll]    = useState(false);
  const setUnreadCount = useNotifStore((s) => s.setUnreadCount);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const backPath = user?.role === 'parent' ? '/home' : '/children';

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    notificationsApi.getAll()
      .then(({ data }) => {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      })
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkOne = async (n: Notification) => {
    if (n.read) return;
    try {
      await notificationsApi.markRead(n._id);
      setNotifications((prev) => prev.map((x) => x._id === n._id ? { ...x, read: true } : x));
      setUnreadCount(Math.max(0, unread - 1));
    } catch { /* silent */ }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { toast.error('Ошибка'); }
    finally { setMarkingAll(false); }
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Уведомления</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {unread > 0 ? `${unread} непрочитанных` : 'Все прочитаны'}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="text-xs font-medium text-[#E07628] hover:text-[#c96a21] disabled:opacity-50 transition-colors"
          >
            {markingAll ? 'Обновление...' : 'Прочитать все'}
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Уведомлений нет</p>
          <p className="text-xs text-gray-400">Здесь будут появляться важные события</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {notifications.map((n) => {
            const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.emotion_reminder;
            return (
              <button
                key={n._id}
                onClick={() => handleMarkOne(n)}
                className={`w-full flex items-start gap-3 px-4 py-4 text-left transition ${
                  n.read ? 'hover:bg-gray-50/60' : 'bg-[#FFFBF7] hover:bg-[#FFF3EA]/60'
                }`}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed ${n.read ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#E07628] flex-shrink-0 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
