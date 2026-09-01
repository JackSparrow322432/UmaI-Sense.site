import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '../../api';
import type { User, Child } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

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

const ROLE_CFG = {
  parent:  { label: 'Родитель', color: '#E07628', bg: '#FFF3EA' },
  trainer: { label: 'Тренер',   color: '#60A5FA', bg: '#EFF6FF' },
};

// ─── Child row ────────────────────────────────────────────────────────────────

function ChildRow({ child }: { child: Child & { parentId?: any } }) {
  return (
    <Link
      to={`/admin/children/${child._id}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition group"
    >
      <div className="w-10 h-10 rounded-xl bg-[#FFF3EA] flex items-center justify-center text-sm font-bold text-[#E07628] flex-shrink-0 overflow-hidden">
        {child.photo
          ? <img src={child.photo} className="w-full h-full object-cover" alt="" />
          : child.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{child.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{getAge(child.dateOfBirth)}</span>
          {child.diagnosis && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-xs bg-[#FFF3EA] text-[#E07628] px-2 py-0.5 rounded-full font-medium">
                {child.diagnosis}
              </span>
            </>
          )}
          {child.parentId?.name && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">Родитель: {child.parentId.name}</span>
            </>
          )}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#E07628] transition-colors flex-shrink-0">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium text-gray-800 ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user,     setUser]     = useState<User | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!id) return;
    adminApi.getUserDetail(id)
      .then(({ data }) => {
        setUser(data.user);
        setChildren(data.children);
      })
      .catch(() => {
        toast.error('Ошибка загрузки');
        navigate('/admin/users');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const roleCfg = ROLE_CFG[user.role as keyof typeof ROLE_CFG];
  const childrenLabel = user.role === 'trainer' ? 'Доступ к профилям' : 'Дети';

  return (
    <div className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/users')}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Профиль пользователя</h1>
      </div>

      {/* User info card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        

        {/* Avatar + name */}
        <div className="px-5 py-5 flex items-center gap-4 border-b border-gray-50">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF3EA] flex items-center justify-center text-2xl font-bold text-[#E07628] flex-shrink-0 overflow-hidden">
            {user.photo
              ? <img src={user.photo} className="w-full h-full object-cover" alt="" />
              : (user.name?.[0] ?? user.email[0]).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">
              {user.name || <span className="text-gray-400 font-normal italic">Без имени</span>}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {roleCfg && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: roleCfg.bg, color: roleCfg.color }}>
                  {roleCfg.label}
                </span>
              )}
              {user.isVerified ? (
                <span className="text-[11px] text-green-500 font-medium">✓ Верифицирован</span>
              ) : (
                <span className="text-[11px] text-gray-400">Не верифицирован</span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-5">
          <InfoRow label="Email"          value={user.email} />
          <InfoRow label="Имя"            value={user.name || '—'} />
          <InfoRow label="Роль"           value={roleCfg?.label ?? user.role} />
          <InfoRow label="Зарегистрирован" value={formatDate(user.createdAt)} />
          <InfoRow
            label="Статус"
            value={user.isVerified ? 'Верифицирован' : 'Не верифицирован'}
            valueClass={user.isVerified ? 'text-green-600' : 'text-gray-400'}
          />
        </div>
      </div>

      {/* Children / Access */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">
          {childrenLabel} · {children.length}
        </p>

        {children.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {user.role === 'trainer' ? 'Нет доступа к профилям' : 'Детей не добавлено'}
            </p>
            <p className="text-xs text-gray-400">
              {user.role === 'trainer'
                ? 'Тренер ещё не принял ни одного приглашения'
                : 'Родитель ещё не создал профили детей'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {children.map((child) => (
              <ChildRow key={child._id} child={child as any} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
