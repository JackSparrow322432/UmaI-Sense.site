import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '../../api';
import type { User } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

const ROLE_CFG = {
  parent:  { label: 'Родитель', color: '#E07628', bg: '#FFF3EA' },
  trainer: { label: 'Тренер',   color: '#60A5FA', bg: '#EFF6FF' },
};

type RoleFilter = 'all' | 'parent' | 'trainer';

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all',     label: 'Все' },
  { key: 'parent',  label: 'Родители' },
  { key: 'trainer', label: 'Тренеры' },
];

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<RoleFilter>('all');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    adminApi.getUsers()
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Ошибка загрузки пользователей'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all:     users.length,
    parent:  users.filter((u) => u.role === 'parent').length,
    trainer: users.filter((u) => u.role === 'trainer').length,
  }), [users]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? users : users.filter((u) => u.role === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Пользователи</h1>
        <p className="text-sm text-gray-400 mt-1">{counts.all} зарегистрированных аккаунтов</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Всего',     value: counts.all,     color: '#6B7280' },
          { label: 'Родителей', value: counts.parent,  color: '#E07628' },
          { label: 'Тренеров',  value: counts.trainer, color: '#60A5FA' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <span className="text-3xl font-bold text-gray-900">{s.value}</span>
            <p className="text-[11px] font-semibold uppercase tracking-wider mt-1.5" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 flex-shrink-0">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === key
                  ? 'bg-[#E07628] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
              <span className={`ml-1.5 text-[10px] ${filter === key ? 'opacity-80' : 'opacity-50'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[2.5fr_1fr_1fr_1.3fr] px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <span className="text-xs font-medium text-gray-500">Пользователь</span>
          <span className="text-xs font-medium text-gray-500">Роль</span>
          <span className="text-xs font-medium text-gray-500">Статус</span>
          <span className="text-xs font-medium text-gray-500">Дата регистрации</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-50 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Нет пользователей</p>
            <p className="text-xs text-gray-400">
              {search ? 'Попробуйте изменить запрос' : 'В этой категории пока никого нет'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((user) => {
              const cfg = ROLE_CFG[user.role as keyof typeof ROLE_CFG];
              return (
                <Link
                  key={user._id}
                  to={`/admin/users/${user._id}`}
                  className="flex sm:grid sm:grid-cols-[2.5fr_1fr_1fr_1.3fr] items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-all group"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] flex items-center justify-center text-sm font-bold text-[#E07628] flex-shrink-0 overflow-hidden">
                      {user.photo
                        ? <img src={user.photo} className="w-full h-full object-cover" alt="" />
                        : (user.name?.[0] ?? user.email[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.name || <span className="text-gray-400 font-normal italic">Без имени</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="hidden sm:block">
                    {cfg ? (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block">
                    {user.isVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        Верифицирован
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
                        Не верифицирован
                      </span>
                    )}
                  </div>

                  {/* Date + chevron */}
                  <div className="hidden sm:flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatDate(user.createdAt)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#E07628] transition-colors">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>

                  {/* Mobile chevron */}
                  <svg className="sm:hidden flex-shrink-0 text-gray-300 group-hover:text-[#E07628] transition-colors ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        )}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Показано {filtered.length} из {users.length} пользователей
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
