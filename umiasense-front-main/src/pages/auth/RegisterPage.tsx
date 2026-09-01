import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../../api';
import AuthLayout from '../../components/auth/AuthLayout';
import { MailIcon } from '../../components/auth/icons';

const inputClass =
  'w-full border border-gray-200 bg-white rounded-lg px-3 py-2.5 pl-9 text-sm text-gray-900 outline-none focus:border-[#E07628] transition-colors placeholder:text-gray-400';

const ROLES = [
  {
    value: 'parent' as const,
    label: 'Родитель',
    desc: 'Создаю профиль ребёнка',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    value: 'trainer' as const,
    label: 'Тренер',
    desc: 'Работаю со специалистами',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'parent' | 'trainer'>('parent');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.sendOtp(email.trim(), role);
      toast.success('Код подтверждения отправлен');
      navigate('/otp', { state: { email: email.trim(), role } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Создать аккаунт" subtitle="Зарегистрируйтесь, чтобы начать">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <MailIcon />
            </span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com" required autoFocus
              className={inputClass}
            />
          </div>
        </div>

        {/* Role selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Кто вы?</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(({ value, label, desc, icon }) => {
              const selected = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`relative flex flex-col items-start gap-2.5 p-3.5 rounded-lg border transition-colors text-left ${
                    selected
                      ? 'border-[#E07628] bg-orange-50/40 text-[#E07628]'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {selected && (
                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[#E07628]" />
                  )}
                  <span>{icon}</span>
                  <div>
                    <p className={`text-sm font-medium leading-tight ${selected ? 'text-[#E07628]' : 'text-gray-800'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#E07628] hover:bg-[#c96a21] text-white rounded-lg py-2.5 font-medium text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Отправка...' : 'Получить код подтверждения'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="text-[#E07628] font-medium hover:text-[#c96a21] transition-colors">
          Войти
        </Link>
      </p>
    </AuthLayout>
  );
}
