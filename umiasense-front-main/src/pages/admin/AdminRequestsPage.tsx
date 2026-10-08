import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { enrollmentApi } from '../../api';
import type { Assignment, EnrollmentRequest, RequestStatus, User } from '../../types';
import {
  REQUEST_STATUS, childFullName, formatDays, formatSlots, formatDateRu, skiText, adaptiveText,
} from '../../utils/enrollment';
import AssignTrainerModal from '../../components/enrollment/AssignTrainerModal';
import ReasonModal from '../../components/enrollment/ReasonModal';

const TABS: { key: RequestStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Новые' },
  { key: 'approved', label: 'Записаны' },
  { key: 'cancelled', label: 'Отменённые' },
  { key: 'all', label: 'Все' },
];

type CancelTarget =
  | { kind: 'request'; item: EnrollmentRequest }
  | { kind: 'assignment'; item: Assignment; childName: string };

export default function AdminRequestsPage() {
  const [tab, setTab] = useState<RequestStatus | 'all'>('pending');
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [counts, setCounts] = useState<Record<RequestStatus, number>>({ pending: 0, approved: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [assignFor, setAssignFor] = useState<EnrollmentRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const reqId = useRef(0);
  const load = () => {
    const id = ++reqId.current;
    setLoading(true);
    enrollmentApi.adminGetRequests(tab === 'all' ? undefined : tab)
      .then(({ data }) => { if (id === reqId.current) { setRequests(data.requests); setCounts(data.counts); } })
      .catch(() => { if (id === reqId.current) toast.error('Ошибка загрузки заявок'); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  useEffect(load, [tab]);

  const doCancel = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      if (cancelTarget.kind === 'request') {
        await enrollmentApi.adminCancelRequest(cancelTarget.item._id, reason);
        toast.success('Заявка отменена, родитель уведомлён');
      } else {
        await enrollmentApi.adminCancelAssignment(cancelTarget.item._id, reason);
        toast.success('Запись к тренеру отменена, будущие занятия удалены');
      }
      setCancelTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка отмены');
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Код скопирован');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Заявки на занятия</h1>
        <p className="text-sm text-gray-400 mt-1">Запишите ребёнка к тренеру на определённые дни — тренер получит код доступа</p>
      </div>

      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === key ? 'bg-[#E07628] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
            {key !== 'all' && <span className={`ml-1.5 text-[10px] ${tab === key ? 'opacity-80' : 'opacity-50'}`}>{counts[key]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">Заявок нет</div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const c = r.childId;
            const p = r.parentId as User;
            const st = REQUEST_STATUS[r.status];
            return (
              <div key={r._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{childFullName(c)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Заявка от {formatDateRu(r.createdAt)}</p>
                    </div>
                    <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <p><span className="text-gray-400">ИИН:</span> <span className="tracking-wider">{c?.iin || '—'}</span></p>
                    <p><span className="text-gray-400">Дата рождения:</span> {formatDateRu(c?.dateOfBirth)}</p>
                    <p><span className="text-gray-400">Родитель:</span> {p?.name || '—'}</p>
                    <p><span className="text-gray-400">Телефон:</span> {r.contactPhone}</p>
                    <p><span className="text-gray-400">Email:</span> {p?.email || '—'}</p>
                    {c?.diagnosis && <p><span className="text-gray-400">Диагноз:</span> {c.diagnosis}</p>}
                    <p className="sm:col-span-2">
                      <span className="text-gray-400">Желаемые дни:</span>{' '}
                      <b className="font-semibold">{formatDays(r.preferredDays)}</b>
                      {(r.preferredTimeFrom || r.preferredTimeTo) && <> · время {r.preferredTimeFrom || '…'}–{r.preferredTimeTo || '…'}</>}
                    </p>
                    <p className="sm:col-span-2"><span className="text-gray-400">Катался на лыжах / обучался:</span> {skiText(c)}</p>
                    <p className="sm:col-span-2"><span className="text-gray-400">Адаптивное катание:</span> {adaptiveText(c)}</p>
                    {r.comment && <p className="sm:col-span-2"><span className="text-gray-400">Комментарий:</span> {r.comment}</p>}
                    {r.status === 'cancelled' && (
                      <p className="sm:col-span-2 text-gray-500">
                        Отменена {r.cancelledBy === 'parent' ? 'родителем' : 'администратором'}{r.adminComment ? `: ${r.adminComment}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Записи к тренерам */}
                  {r.assignments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Записи к тренерам</p>
                      {r.assignments.map((a) => {
                        const t = a.trainerId as User;
                        const cancelled = a.status === 'cancelled';
                        return (
                          <div key={a._id} className={`rounded-lg border px-3 py-2.5 text-sm flex items-start gap-3 ${cancelled ? 'bg-gray-50 border-gray-100 text-gray-400' : 'border-gray-200'}`}>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium ${cancelled ? 'line-through' : 'text-gray-900'}`}>{t?.name || t?.email || 'Тренер'}</p>
                              <p className="text-xs mt-0.5">
                                {formatSlots(a.slots)} · {a.durationMin} мин · {formatDateRu(a.startDate)} – {formatDateRu(a.endDate)}
                              </p>
                              {!cancelled && (
                                <p className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                                  <span>Код доступа:</span>
                                  <button onClick={() => a.accessCode && copy(a.accessCode)} className="font-mono font-bold text-[#E07628] tracking-wider" title="Скопировать">
                                    {a.accessCode}
                                  </button>
                                  <span className={a.codeUsed ? 'text-emerald-600' : 'text-amber-600'}>
                                    {a.codeUsed ? '✓ тренер ввёл код' : 'ожидает ввода'}
                                  </span>
                                </p>
                              )}
                              {cancelled && <p className="text-xs mt-0.5">Отменена{a.cancelReason ? `: ${a.cancelReason}` : ''}</p>}
                            </div>
                            {!cancelled && (
                              <button
                                onClick={() => setCancelTarget({ kind: 'assignment', item: a, childName: childFullName(c) })}
                                className="text-xs text-red-500 hover:text-red-600 font-semibold flex-shrink-0"
                              >
                                Отменить
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {r.status !== 'cancelled' && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCancelTarget({ kind: 'request', item: r })}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition"
                    >
                      Отменить заявку
                    </button>
                    <button
                      onClick={() => setAssignFor(r)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#E07628] hover:bg-[#C4641A] text-white transition"
                    >
                      {r.status === 'approved' ? '+ Ещё тренер' : 'Записать к тренеру'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assignFor && (
        <AssignTrainerModal
          request={assignFor}
          onClose={() => setAssignFor(null)}
          onDone={() => { setAssignFor(null); load(); }}
        />
      )}

      {cancelTarget && (
        <ReasonModal
          title={cancelTarget.kind === 'request' ? 'Отменить заявку' : 'Отменить запись к тренеру'}
          description={
            cancelTarget.kind === 'request'
              ? `Заявка ${childFullName(cancelTarget.item.childId)} будет отменена вместе со всеми записями к тренерам и будущими занятиями.`
              : `Все будущие занятия ${cancelTarget.childName} с этим тренером будут отменены, код доступа перестанет действовать.`
          }
          confirmLabel="Подтвердить отмену"
          onConfirm={doCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
