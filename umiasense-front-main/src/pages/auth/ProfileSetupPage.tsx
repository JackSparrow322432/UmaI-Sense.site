import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/common/PasswordInput';
import { UserIcon } from '../../components/auth/icons';

export default function ProfileSetupPage() {
  const { state } = useLocation() as { state: { email: string; role: string } | null };
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  if (!state?.email) return <Navigate to="/register" replace />;

  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error('Имя слишком короткое'); return; }
    if (password.length < 6) { toast.error('Пароль минимум 6 символов'); return; }
    if (password !== confirm) { toast.error('Пароли не совпадают'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.completeRegistration({ email: state.email, name: name.trim(), password, role: state.role });
      setAuth(data.token, data.user);
      toast.success('Добро пожаловать!');
      navigate('/children');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Настройка профиля" subtitle="Последний шаг — задайте имя и пароль">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ваше имя</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><UserIcon /></span>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Жанат Каратай" required autoFocus
              className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Пароль</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Минимум 6 символов" required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Повторите пароль</label>
          <PasswordInput value={confirm} onChange={setConfirm} required error={mismatch} />
          {mismatch && <p className="text-xs text-red-400 mt-1">Пароли не совпадают</p>}
        </div>

        <button
          type="submit" disabled={loading || mismatch || password.length < 6}
          className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 font-semibold text-sm transition disabled:opacity-50 shadow-sm shadow-[#E07628]/30 mt-2"
        >
          {loading ? 'Создание аккаунта...' : 'Завершить регистрацию'}
        </button>
      </form>
    </AuthLayout>
  );
}
