import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ModalShell from '../modals/ModalShell';
import { enrollmentApi } from '../../api';
import type { EnrollmentRequest, User, Weekday } from '../../types';
import { WEEKDAYS, childFullName, toDateStr } from '../../utils/enrollment';

const inputClass =
  'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition text-gray-800';
const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

interface Props {
  request: EnrollmentRequest;
  onClose: () => void;
  onDone: () => void;
}

/** Администратор записывает ребёнка к тренеру: дни, время, период → занятия в календаре + код доступа тренеру */
export default function AssignTrainerModal({ request, onClose, onDone }: Props) {
  const [trainers, setTrainers] = useState<User[]>([]);
  const [trainerId, setTrainerId] = useState('');
  const defaultTime = request.preferredTimeFrom || '10:00';
  const [times, setTimes] = useState<Partial<Record<Weekday, string>>>(
    () => Object.fromEntries(request.preferredDays.map((d) => [d, defaultTime]))
  );
  const [duration, setDuration] = useState(45);
  const today = toDateStr(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return toDateStr(d);
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    enrollmentApi.adminGetTrainers()
      .then(({ data }) => setTrainers(data))
      .catch(() => toast.error('Не удалось загрузить тренеров'));
  }, []);

  const toggle = (d: Weekday) =>
    setTimes((t) => {
      const next = { ...t };
      if (next[d] !== undefined) delete next[d];
      else next[d] = defaultTime;
      return next;
    });

  const slots = (Object.entries(times) as [string, string][])
    .filter(([, t]) => !!t)
    .map(([d, t]) => ({ weekday: Number(d) as Weekday, startTime: t }));

  const canSave = !!trainerId && slots.length > 0 && startDate && endDate && startDate <= endDate && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data } = await enrollmentApi.adminAssign(request._id, {
        trainerId, slots, durationMin: duration, startDate, endDate,
      });
      toast.success(`Записано: ${data.sessionsCreated} занятий. Код доступа отправлен тренеру`);
      if (data.conflicts > 0) toast.warning(`У тренера пересекаются ${data.conflicts} занятий — проверьте календарь`);
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка записи');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Записать: ${childFullName(request.childId)}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Тренер *</label>
          <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className={inputClass + ' cursor-pointer'}>
            <option value="">Выберите тренера…</option>
            {trainers.map((t) => <option key={t._id} value={t._id}>{t.name || t.email}</option>)}
          </select>
          {trainers.length === 0 && <p className="text-xs text-gray-400 mt-1">Нет зарегистрированных тренеров</p>}
        </div>

        <div>
          <label className={labelClass}>Дни и время начала *</label>
          <p className="text-[11px] text-gray-400 mb-2">Родитель просил: отмечены по умолчанию</p>
          <div className="space-y-1.5">
            {WEEKDAYS.map((d) => {
              const on = times[d.value] !== undefined;
              const wanted = request.preferredDays.includes(d.value);
              return (
                <div key={d.value} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(d.value)}
                    className={`w-32 text-left px-3 py-2 rounded-lg border text-sm transition ${
                      on ? 'bg-[#FFF3EA] border-[#E07628] text-[#E07628] font-semibold' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {d.full}{wanted && ' ★'}
                  </button>
                  {on && (
                    <input
                      type="time"
                      value={times[d.value]}
                      onChange={(e) => setTimes((t) => ({ ...t, [d.value]: e.target.value }))}
                      className={inputClass + ' max-w-[130px]'}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>Длительность</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
              {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} мин</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>С</label>
            <input type="date" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>По</label>
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          После записи занятия появятся в календаре у вас, родителя и тренера. Тренер получит код доступа — данные ребёнка
          (ФИО, ИИН, родитель, дни) откроются ему после ввода кода.
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition">Отмена</button>
          <button onClick={save} disabled={!canSave} className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">
            {saving ? 'Запись…' : 'Записать'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
