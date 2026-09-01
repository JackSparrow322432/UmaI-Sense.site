import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../../api';
import AuthLayout from '../../components/auth/AuthLayout';
import { MailIcon } from '../../components/auth/icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      toast.success('Если аккаунт существует — код отправлен');
      navigate('/reset-password', { state: { email: email.trim() } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Сброс пароля" subtitle="Введите email, чтобы получить код">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><MailIcon /></span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com" required autoFocus
              className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 font-semibold text-sm transition disabled:opacity-60 shadow-sm shadow-[#E07628]/30">
          {loading ? 'Отправка...' : 'Отправить код'}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link to="/login" className="text-sm text-[#E07628] font-medium hover:underline">← Назад ко входу</Link>
      </p>
    </AuthLayout>
  );
}
