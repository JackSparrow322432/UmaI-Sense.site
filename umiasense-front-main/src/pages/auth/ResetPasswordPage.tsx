import { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../../api';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/common/PasswordInput';

export default function ResetPasswordPage() {
  const { state } = useLocation() as { state: { email: string } | null };
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!state?.email) return <Navigate to="/forgot-password" replace />;

  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error('Введите 6-значный код'); return; }
    if (password.length < 6) { toast.error('Пароль минимум 6 символов'); return; }
    if (password !== confirm) { toast.error('Пароли не совпадают'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(state.email, code, password);
      toast.success('Пароль изменён');
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Неверный или истёкший код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Новый пароль" subtitle={`Код отправлен на ${state.email}`}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Код из письма</label>
          <input
            type="text" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" maxLength={6} inputMode="numeric" autoFocus
            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-[0.6em] outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Новый пароль</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Минимум 6 символов" required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Повторите пароль</label>
          <PasswordInput value={confirm} onChange={setConfirm} required error={mismatch} />
          {mismatch && <p className="text-xs text-red-400 mt-1">Пароли не совпадают</p>}
        </div>

        <button
          type="submit" disabled={loading || mismatch || code.length !== 6 || password.length < 6}
          className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 font-semibold text-sm transition disabled:opacity-50 shadow-sm shadow-[#E07628]/30"
        >
          {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-[#E07628] transition">← Изменить email</Link>
      </p>
    </AuthLayout>
  );
}
