import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/common/PasswordInput';
import { MailIcon, LockIcon } from '../../components/auth/icons';

const inputClass =
  'w-full border border-gray-200 bg-white rounded-lg px-3 py-2.5 pl-9 text-sm text-gray-900 outline-none focus:border-[#E07628] transition-colors placeholder:text-gray-400';

const labelClass = 'block text-xs font-medium text-gray-600 mb-1.5';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(email.trim(), password);
      setAuth(data.token, data.user);
      if (data.user.role === 'admin')  navigate('/admin/users');
      else if (data.user.role === 'parent') navigate('/home');
      else navigate('/children');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Войти в аккаунт" subtitle="Платформа для сопровождения детей">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className={labelClass}>Email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><MailIcon /></span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com" required autoFocus className={inputClass} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelClass} style={{ marginBottom: 0 }}>Пароль</label>
            <Link to="/forgot-password" className="text-xs text-[#E07628] hover:text-[#c96a21] font-medium transition-colors">
              Забыли пароль?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none"><LockIcon /></span>
            <div className="[&>div>input]:pl-9">
              <PasswordInput value={password} onChange={setPassword} required />
            </div>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-[#E07628] hover:bg-[#c96a21] text-white rounded-lg py-2.5 font-medium text-sm transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Нет аккаунта?{' '}
        <Link to="/register" className="text-[#E07628] font-medium hover:text-[#c96a21] transition-colors">Зарегистрироваться</Link>
      </p>
    </AuthLayout>
  );
}
