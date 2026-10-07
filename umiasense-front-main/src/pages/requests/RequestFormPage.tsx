import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi, enrollmentApi } from '../../api';
import type { Child, Weekday } from '../../types';
import { WEEKDAYS, childFullName, isChildReadyForEnrollment, formatDateRu } from '../../utils/enrollment';

const inputClass =
  'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';
const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

export default function RequestFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState(params.get('childId') ?? '');
  const [days, setDays] = useState<Weekday[]>([]);
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    childrenApi.getAll()
      .then(({ data }) => {
        setChildren(data);
        if (!params.get('childId') && data.length === 1) setChildId(data[0]._id);
      })
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const child = useMemo(() => children.find((c) => c._id === childId), [children, childId]);
  const ready = child ? isChildReadyForEnrollment(child) : false;

  const toggleDay = (d: Weekday) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort() as Weekday[]));

  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const timeOk = !timeFrom || !timeTo || timeFrom < timeTo;
  const canSubmit = !!child && ready && days.length > 0 && phoneOk && timeOk && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await enrollmentApi.createRequest({
        childId,
        preferredDays: days,
        preferredTimeFrom: timeFrom || undefined,
        preferredTimeTo: timeTo || undefined,
        contactPhone: phone.trim(),
        comment: comment.trim() || undefined,
      });
      toast.success('Заявка отправлена администратору');
      navigate('/requests');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка отправки');
    } finally {
      setSaving(false);
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
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/requests')}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 transition"
          aria-label="Назад"
        >‹</button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Заявка на занятия</h1>
          <p className="text-xs text-gray-400 mt-0.5">Администратор подберёт тренера и время и запишет ребёнка</p>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-4">Сначала добавьте профиль ребёнка</p>
          <Link to="/children/new" className="inline-flex bg-[#E07628] text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            Добавить ребёнка
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Child */}
          <div>
            <label className={labelClass}>Ребёнок <span className="text-[#E07628]">*</span></label>
            <select value={childId} onChange={(e) => setChildId(e.target.value)} className={inputClass + ' cursor-pointer'}>
              <option value="">Выберите…</option>
              {children.map((c) => <option key={c._id} value={c._id}>{childFullName(c)}</option>)}
            </select>
          </div>

          {child && (
            ready ? (
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Данные ребёнка в заявке</p>
                <p><span className="text-gray-400">ФИО:</span> {childFullName(child)}</p>
                <p><span className="text-gray-400">ИИН:</span> <span className="tracking-wider">{child.iin}</span></p>
                <p><span className="text-gray-400">Дата рождения:</span> {formatDateRu(child.dateOfBirth)}</p>
                {child.diagnosis && <p><span className="text-gray-400">Диагноз:</span> {child.diagnosis}</p>}
                <p>
                  <span className="text-gray-400">Адаптивное катание:</span>{' '}
                  {child.adaptiveSkating?.hasExperience
                    ? `занимался (${child.adaptiveSkating.when})`
                    : 'ранее не занимался'}
                </p>
                <Link to={`/children/${child._id}/profile`} className="inline-block text-xs text-[#E07628] font-semibold mt-1">Изменить данные</Link>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                В профиле не хватает фамилии, ИИН или информации об адаптивном катании.{' '}
                <Link to={`/children/${child._id}/profile`} className="font-semibold underline">Заполнить профиль</Link>
              </div>
            )
          )}

          {/* Days */}
          <div>
            <label className={labelClass}>Удобные дни <span className="text-[#E07628]">*</span></label>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    title={d.full}
                    className={`py-2.5 rounded-xl border text-sm font-semibold transition ${
                      on ? 'bg-[#E07628] border-[#E07628] text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className={labelClass}>Удобное время <span className="text-gray-300">— необязательно</span></label>
            <div className="flex items-center gap-2">
              <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className={inputClass} />
              <span className="text-gray-400 text-sm">—</span>
              <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className={inputClass} />
            </div>
            {!timeOk && <p className="text-xs text-red-500 mt-1">Время «до» должно быть позже времени «с»</p>}
          </div>

          {/* Phone */}
          <div>
            <label className={labelClass}>Контактный телефон <span className="text-[#E07628]">*</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00" className={inputClass} />
          </div>

          {/* Comment */}
          <div>
            <label className={labelClass}>Комментарий для администратора</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              placeholder="Пожелания по тренеру, особенности ребёнка и т. п." className={inputClass + ' resize-none'} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => navigate('/requests')}
              className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
              Отмена
            </button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'Отправка…' : 'Отправить заявку'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
