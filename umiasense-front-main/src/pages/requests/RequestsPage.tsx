import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { enrollmentApi } from '../../api';
import type { EnrollmentRequest, User } from '../../types';
import { REQUEST_STATUS, childFullName, formatDays, formatSlots, formatDateRu } from '../../utils/enrollment';

export default function RequestsPage() {
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    enrollmentApi.getMyRequests()
      .then(({ data }) => setRequests(data))
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const withdraw = async (id: string) => {
    if (!confirm('Отозвать заявку?')) return;
    setBusy(id);
    try {
      await enrollmentApi.withdrawRequest(id);
      toast.success('Заявка отозвана');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка');
    } finally {
      setBusy(null);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Заявки на занятия</h1>
          <p className="text-sm text-gray-400 mt-0.5">Администратор записывает детей к тренерам по вашим заявкам</p>
        </div>
        <Link to="/requests/new" className="inline-flex items-center gap-1.5 bg-[#E07628] hover:bg-[#C4641A] text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm">
          + Новая заявка
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Заявок пока нет. Отправьте заявку, указав удобные дни — администратор подберёт тренера.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const st = REQUEST_STATUS[r.status];
            const active = r.assignments.filter((a) => a.status === 'active');
            return (
              <div key={r._id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{childFullName(r.childId)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      от {formatDateRu(r.createdAt)} · дни: {formatDays(r.preferredDays)}
                      {(r.preferredTimeFrom || r.preferredTimeTo) && ` · ${r.preferredTimeFrom || '…'}–${r.preferredTimeTo || '…'}`}
                    </p>
                  </div>
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0" style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>

                {active.length > 0 && (
                  <div className="space-y-2">
                    {active.map((a) => (
                      <div key={a._id} className="bg-[#EDFAF5] rounded-lg px-3 py-2 text-sm">
                        <p className="font-medium text-gray-900">Тренер: {(a.trainerId as User)?.name || '—'}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {formatSlots(a.slots)} · {a.durationMin} мин · {formatDateRu(a.startDate)} – {formatDateRu(a.endDate)}
                        </p>
                      </div>
                    ))}
                    <Link to="/schedule" className="inline-block text-xs text-[#E07628] font-semibold">Открыть расписание →</Link>
                  </div>
                )}

                {r.status === 'cancelled' && r.cancelledBy === 'admin' && (
                  <p className="text-xs text-gray-500">Отменена администратором{r.adminComment ? `: ${r.adminComment}` : ''}</p>
                )}

                {r.status === 'pending' && (
                  <button onClick={() => withdraw(r._id)} disabled={busy === r._id} className="text-xs text-gray-400 hover:text-red-500 font-medium transition disabled:opacity-50">
                    {busy === r._id ? '…' : 'Отозвать заявку'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
