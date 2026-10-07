import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { enrollmentApi } from '../../api';
import type { Session, UserRole } from '../../types';
import { childFullName, toDateStr } from '../../utils/enrollment';
import ReasonModal from './ReasonModal';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEK_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

// Цвет по тренеру/ребёнку — чтобы в месяце было видно, кто с кем
const PALETTE = ['#E07628', '#2563EB', '#059669', '#9333EA', '#DB2777', '#0891B2', '#CA8A04', '#4F46E5'];
const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

interface Props {
  role: UserRole;
  /** Только для администратора: фильтр по тренеру */
  trainerId?: string;
  /** Администратор может отменять отдельные занятия */
  canCancel?: boolean;
}

export default function ScheduleCalendar({ role, trainerId, canCancel }: Props) {
  const today = toDateStr(new Date());
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<string>(today);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Session | null>(null);

  // Сетка: с понедельника недели, в которой 1-е число, 6 недель
  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const from = toDateStr(days[0]);
  const to = toDateStr(days[41]);

  // reqId защищает от гонки: при быстром листании месяцев старый ответ не перетрёт новый
  const reqId = useRef(0);
  const load = () => {
    const id = ++reqId.current;
    setLoading(true);
    enrollmentApi.getSessions(from, to, trainerId ? { trainerId } : undefined)
      .then(({ data }) => { if (id === reqId.current) setSessions(data); })
      .catch(() => { if (id === reqId.current) toast.error('Не удалось загрузить расписание'); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  useEffect(load, [from, to, trainerId]);

  const visible = useMemo(
    () => sessions.filter((s) => showCancelled || s.status === 'scheduled'),
    [sessions, showCancelled]
  );

  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of visible) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [visible]);

  const chipLabel = (s: Session) => {
    if (role === 'trainer') return childFullName(s.childId);
    if (role === 'parent') return `${s.childId?.name ?? ''} · ${s.trainerId?.name ?? ''}`;
    return `${childFullName(s.childId)} · ${s.trainerId?.name ?? ''}`;
  };
  const chipColorKey = (s: Session) => (role === 'trainer' ? s.childId?._id : s.trainerId?._id) ?? '';

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(today); };

  const selectedList = byDate.get(selected) ?? [];
  const [sy, sm, sd] = selected.split('-').map(Number);
  const selectedDate = new Date(sy, sm - 1, sd);

  const doCancel = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      await enrollmentApi.adminCancelSession(cancelTarget._id, reason);
      toast.success('Занятие отменено, родитель и тренер уведомлены');
      setCancelTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка отмены');
    }
  };

  const scheduledCount = sessions.filter((s) => s.status === 'scheduled' && s.date.slice(0, 7) === toDateStr(month).slice(0, 7)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-800 transition" aria-label="Предыдущий месяц">‹</button>
          <h2 className="text-base font-semibold text-gray-900 min-w-[140px] text-center">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </h2>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-800 transition" aria-label="Следующий месяц">›</button>
          <button onClick={goToday} className="ml-1 px-3 h-9 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Сегодня</button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{loading ? 'Загрузка…' : `${scheduledCount} занятий в месяце`}</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="accent-[#E07628]" />
            Отменённые
          </label>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${i >= 5 ? 'text-[#E07628]' : 'text-gray-400'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = toDateStr(d);
            const inMonth = d.getMonth() === month.getMonth();
            const list = byDate.get(key) ?? [];
            const isSel = key === selected;
            const isToday = key === today;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`relative min-h-[56px] sm:min-h-[96px] border-b border-r border-gray-100 p-1 sm:p-1.5 text-left align-top transition ${
                  isSel ? 'bg-[#FFF3EA]' : 'hover:bg-gray-50'
                } ${inMonth ? '' : 'bg-gray-50/60'}`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                  isToday ? 'bg-[#E07628] text-white font-semibold' : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {d.getDate()}
                </span>

                {/* Mobile: точки */}
                {list.length > 0 && (
                  <div className="sm:hidden flex flex-wrap gap-0.5 mt-0.5 px-0.5">
                    {list.slice(0, 4).map((s) => (
                      <span key={s._id} className="w-1.5 h-1.5 rounded-full" style={{ background: s.status === 'cancelled' ? '#D1D5DB' : colorFor(chipColorKey(s)) }} />
                    ))}
                  </div>
                )}

                {/* Desktop: чипы */}
                <div className="hidden sm:flex flex-col gap-0.5 mt-0.5">
                  {list.slice(0, 3).map((s) => {
                    const c = colorFor(chipColorKey(s));
                    const cancelled = s.status === 'cancelled';
                    return (
                      <span
                        key={s._id}
                        className={`block truncate rounded px-1 py-0.5 text-[10.5px] leading-tight ${cancelled ? 'line-through text-gray-400 bg-gray-100' : ''}`}
                        style={cancelled ? undefined : { background: `${c}14`, color: c }}
                        title={`${s.startTime}–${s.endTime} ${chipLabel(s)}`}
                      >
                        <b className="font-semibold">{s.startTime}</b> {chipLabel(s)}
                      </span>
                    );
                  })}
                  {list.length > 3 && <span className="text-[10px] text-gray-400 px-1">ещё {list.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day details */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">
            {selectedDate.getDate()} {MONTHS_GEN[selectedDate.getMonth()]}, {WEEK_FULL[(selectedDate.getDay() + 6) % 7]}
          </p>
        </div>
        {selectedList.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Нет занятий в этот день</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {selectedList.map((s) => {
              const cancelled = s.status === 'cancelled';
              const c = colorFor(chipColorKey(s));
              return (
                <li key={s._id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-1 self-stretch rounded-full" style={{ background: cancelled ? '#E5E7EB' : c }} />
                  <div className="w-24 flex-shrink-0">
                    <p className={`text-sm font-semibold ${cancelled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{s.startTime}–{s.endTime}</p>
                    {cancelled && <p className="text-[11px] text-red-500 font-medium mt-0.5">Отменено</p>}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-medium text-gray-900">{childFullName(s.childId)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Тренер: {s.trainerId?.name || '—'}
                      {role !== 'parent' && <> · Родитель: {s.parentId?.name || '—'}</>}
                    </p>
                    {cancelled && s.cancelReason && <p className="text-xs text-gray-400 mt-0.5">Причина: {s.cancelReason}</p>}
                  </div>
                  {canCancel && !cancelled && s.date >= today && (
                    <button onClick={() => setCancelTarget(s)} className="text-xs text-red-500 hover:text-red-600 font-semibold flex-shrink-0">
                      Отменить
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {cancelTarget && (
        <ReasonModal
          title="Отменить занятие"
          description={`${childFullName(cancelTarget.childId)}, ${cancelTarget.date.split('-').reverse().join('.')} в ${cancelTarget.startTime}. Родитель и тренер получат уведомление.`}
          confirmLabel="Отменить занятие"
          onConfirm={doCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
