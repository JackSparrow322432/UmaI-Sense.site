import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi, invitesApi } from '../../api';
import type { Child } from '../../types';
import { useAuthStore } from '../../store/authStore';

const getAge = (dob: string) => {
  const d = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - d.getFullYear() -
    (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  const y = years % 10; const yr = years % 100;
  if (yr >= 11 && yr <= 19) return `${years} лет`;
  if (y === 1) return `${years} год`;
  if (y >= 2 && y <= 4) return `${years} года`;
  return `${years} лет`;
};

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const KeyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

function EnterCodeForm({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data } = await invitesApi.use(code.trim().toUpperCase());
      toast.success(`Доступ к профилю ${data.child.name} получен`);
      setCode(''); setOpen(false); onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Неверный или истёкший код');
    } finally { setLoading(false); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 border border-dashed border-gray-300 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-500 hover:border-[#E07628] hover:text-[#E07628] hover:bg-gray-50 transition-all"
      >
        <KeyIcon />
        Ввести код-приглашение от родителя
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-700">Введите код-приглашение</p>
      <input
        type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="UMS-XXXX" maxLength={8} autoFocus
        className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-center text-xl font-bold tracking-widest outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(false); setCode(''); }}
          className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
          Отмена
        </button>
        <button type="submit" disabled={loading || code.length < 8}
          className="flex-1 bg-[#E07628] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#C4641A] transition disabled:opacity-50">
          {loading ? 'Проверка...' : 'Применить'}
        </button>
      </div>
    </form>
  );
}

function EmptyState({ isParent }: { isParent: boolean }) {
  if (isParent) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#E07628] via-[#F59B56] to-[#E07628]" />
        <div className="px-8 py-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFF3EA] mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-2">Начните с добавления ребёнка</h3>
          <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-xs mx-auto">
            Создайте профиль, чтобы отслеживать эмоции, активности и развитие. Специалисты смогут получить доступ по вашему коду.
          </p>
          <Link
            to="/children/new"
            className="inline-flex items-center gap-2 bg-[#E07628] hover:bg-[#C4641A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
          >
            <PlusIcon /> Добавить профиль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 mb-5">
        <KeyIcon />
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-2">Нет доступных профилей</h3>
      <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
        Запросите код-приглашение у родителя и введите его выше, чтобы получить доступ к профилю ребёнка.
      </p>
    </div>
  );
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { user } = useAuthStore();
  const isParent = user?.role === 'parent';

  const fetchChildren = () => {
    childrenApi.getAll()
      .then(({ data }) => setChildren(data))
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchChildren(); }, []);

  const handleDelete = async (e: React.MouseEvent, childId: string, name: string) => {
    e.preventDefault();
    if (!confirm(`Удалить профиль ${name}?`)) return;
    setDeleting(childId);
    try {
      await childrenApi.delete(childId);
      setChildren((prev) => prev.filter((c) => c._id !== childId));
      toast.success('Профиль удалён');
    } catch { toast.error('Ошибка удаления'); }
    finally { setDeleting(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Профили</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {children.length > 0
              ? `${children.length} ${children.length === 1 ? 'профиль' : children.length < 5 ? 'профиля' : 'профилей'}`
              : isParent ? 'Добавьте первый профиль' : 'Профили ещё не добавлены'}
          </p>
        </div>
        {isParent && (
          <Link
            to="/children/new"
            className="inline-flex items-center gap-1.5 bg-[#E07628] hover:bg-[#C4641A] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <PlusIcon /> Добавить
          </Link>
        )}
      </div>

      {/* Trainer enter code */}
      {!isParent && <EnterCodeForm onSuccess={fetchChildren} />}

      {/* Empty state */}
      {children.length === 0 && <EmptyState isParent={isParent} />}

      {/* Children list */}
      {children.length > 0 && (
        <div className="space-y-3">
          {children.map((child) => (
            <Link
              key={child._id}
              to={`/children/${child._id}`}
              className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 border border-gray-100 hover:border-[#E07628]/20 transition-all group"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-xl bg-[#FFF3EA] flex items-center justify-center text-base font-bold text-[#E07628] flex-shrink-0 overflow-hidden">
                {child.photo
                  ? <img src={child.photo} className="w-full h-full object-cover" alt="" />
                  : child.name[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{child.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-400">{getAge(child.dateOfBirth)}</span>
                  {child.diagnosis && (
                    <>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs bg-orange-50 text-[#E07628] px-2 py-0.5 rounded-full font-medium">
                        {child.diagnosis}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {isParent && (
                  <button
                    onClick={(e) => handleDelete(e, child._id, child.name)}
                    disabled={deleting === child._id}
                    className="text-xs text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100 disabled:opacity-50 px-2 py-1"
                  >
                    {deleting === child._id ? '...' : 'Удалить'}
                  </button>
                )}
                <span className="text-gray-300 group-hover:text-[#E07628] transition"><ChevronIcon /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
