import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../../api';
import AuthLayout from '../../components/auth/AuthLayout';

const RESEND_COOLDOWN = 60;

export default function OtpPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { state } = useLocation() as { state: { email: string; role: string } | null };
  const navigate = useNavigate();

  if (!state?.email) return <Navigate to="/register" replace />;

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => { if (prev <= 1) { clearInterval(intervalRef.current!); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error('Введите 6-значный код'); return; }
    setLoading(true);
    try {
      await authApi.verifyOtp(state.email, code);
      navigate('/setup', { state: { email: state.email, role: state.role } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Неверный код');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendOtp(state.email);
      toast.success('Новый код отправлен');
      setCode('');
      setCountdown(RESEND_COOLDOWN);
      clearInterval(intervalRef.current!);
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => { if (prev <= 1) { clearInterval(intervalRef.current!); return 0; } return prev - 1; });
      }, 1000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Подтверждение email" subtitle={`Код отправлен на ${state.email}`}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Code input */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Код из письма</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            required
            autoFocus
            inputMode="numeric"
            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-[0.6em] outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 font-semibold text-sm transition disabled:opacity-50 shadow-sm shadow-[#E07628]/30"
        >
          {loading ? 'Проверка...' : 'Подтвердить'}
        </button>
      </form>

      <div className="mt-6 text-center space-y-3">
        {countdown > 0 ? (
          <p className="text-sm text-gray-400">
            Повторная отправка через <span className="font-semibold text-[#E07628]">{countdown}с</span>
          </p>
        ) : (
          <button onClick={handleResend} disabled={resending} className="text-sm font-medium text-[#E07628] hover:underline disabled:opacity-50">
            {resending ? 'Отправка...' : 'Отправить код повторно'}
          </button>
        )}
        <div>
          <button onClick={() => navigate('/register')} className="text-xs text-gray-400 hover:text-gray-600 transition">
            ← Изменить email
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
