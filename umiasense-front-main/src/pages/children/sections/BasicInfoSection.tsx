import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { childrenApi, uploadApi } from '../../../api';
import type { Child } from '../../../types';
import AdaptiveSkatingFields, {
  emptySkating, validateSkating, skatingPayload, type SkatingForm,
} from '../../../components/enrollment/AdaptiveSkatingFields';
import { isValidIin, iinMatchesBirthDate, isChildReadyForEnrollment } from '../../../utils/enrollment';

const COMMUNICATION_OPTIONS = [
  'Вербальная речь', 'ААС-устройство', 'PECS карточки', 'Жестовый язык', 'Другое',
];

const getAge = (dob: string) => {
  const d = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - d.getFullYear() -
    (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  const y = years % 10;
  const yr = years % 100;
  let label = `${years} `;
  if (yr >= 11 && yr <= 19) label += 'лет';
  else if (y === 1) label += 'год';
  else if (y >= 2 && y <= 4) label += 'года';
  else label += 'лет';
  return label;
};

interface Props {
  child: Child;
  canEdit: boolean;
  onRefresh: () => void;
}

export default function BasicInfoSection({ child, canEdit, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: child.name,
    lastName: child.lastName || '',
    iin: child.iin || '',
    dateOfBirth: child.dateOfBirth.split('T')[0],
    diagnosis: child.diagnosis || '',
    communicationMethod: child.communicationMethod || '',
    photo: child.photo || '',
  });

  const [skating, setSkating] = useState<SkatingForm>(emptySkating(child));
  const set = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadApi.image(file);
      set('photo', data.url);
    } catch {
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = () => {
    setForm({
      name: child.name,
      lastName: child.lastName || '',
      iin: child.iin || '',
      dateOfBirth: child.dateOfBirth.split('T')[0],
      diagnosis: child.diagnosis || '',
      communicationMethod: child.communicationMethod || '',
      photo: child.photo || '',
    });
    setSkating(emptySkating(child));
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Имя обязательно'); return; }
    if (!form.lastName.trim()) { toast.error('Фамилия обязательна'); return; }
    if (!isValidIin(form.iin)) { toast.error('Проверьте ИИН — 12 цифр'); return; }
    const skatingError = validateSkating(skating);
    if (skatingError) { toast.error(skatingError); return; }
    setSaving(true);
    try {
      await childrenApi.update(child._id, {
        name: form.name.trim(),
        lastName: form.lastName.trim(),
        iin: form.iin,
        ...skatingPayload(skating),
        dateOfBirth: form.dateOfBirth,
        diagnosis: form.diagnosis.trim() || undefined,
        communicationMethod: form.communicationMethod || undefined,
        photo: form.photo || undefined,
      });
      toast.success('Сохранено');
      onRefresh();
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-5">
        {/* Photo */}
        <div className="flex justify-center">
          <div className="relative">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-full bg-[#FFF3EA] flex items-center justify-center cursor-pointer hover:opacity-80 transition overflow-hidden border-2 border-dashed border-[#E07628]/40"
            >
              {form.photo ? (
                <img src={form.photo} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-3xl">📷</span>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center text-xs text-[#E07628]">...</div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhoto} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Имя</label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Фамилия <span className="text-[#E07628]">*</span></label>
          <input type="text" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ИИН <span className="text-[#E07628]">*</span></label>
          <input type="text" inputMode="numeric" value={form.iin} onChange={(e) => set('iin', e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12 цифр" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition tracking-wider" />
          {form.iin.length === 12 && !isValidIin(form.iin) && (
            <p className="text-xs text-red-500 mt-1">ИИН не прошёл проверку — проверьте цифры</p>
          )}
          {form.iin.length >= 6 && form.dateOfBirth && !iinMatchesBirthDate(form.iin, form.dateOfBirth) && (
            <p className="text-xs text-amber-600 mt-1">Первые 6 цифр ИИН не совпадают с датой рождения — проверьте</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Дата рождения</label>
          <input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} max={new Date().toISOString().split('T')[0]} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Диагноз</label>
          <input type="text" value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} placeholder="Не указан" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Способ общения</label>
          <select value={form.communicationMethod} onChange={(e) => set('communicationMethod', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition bg-white">
            <option value="">Не указан</option>
            {COMMUNICATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <AdaptiveSkatingFields value={skating} onChange={setSkating} />

        <div className="flex gap-3">
          <button onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition">Отмена</button>
          <button onClick={save} disabled={saving || uploading} className="flex-1 bg-[#E07628] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#C4641A] transition disabled:opacity-50">{saving ? 'Сохранение...' : 'Сохранить'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#FFF3EA] flex items-center justify-center text-2xl font-bold text-[#E07628] overflow-hidden flex-shrink-0">
          {child.photo ? <img src={child.photo} className="w-full h-full object-cover" alt="" /> : child.name[0]}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{[child.name, child.lastName].filter(Boolean).join(' ')}</p>
          <p className="text-sm text-gray-500">{getAge(child.dateOfBirth)} · {new Date(child.dateOfBirth).toLocaleDateString('ru-RU')}</p>
        </div>
        {canEdit && (
          <button onClick={startEdit} className="ml-auto text-sm text-[#E07628] font-semibold hover:underline">Изменить</button>
        )}
      </div>

      {canEdit && !isChildReadyForEnrollment(child) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Заполните фамилию, ИИН и ответы о катании на лыжах и адаптивном катании — без них нельзя подать заявку на занятия.
          <button onClick={startEdit} className="ml-1 font-semibold underline">Заполнить</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">ИИН</p>
          <p className="text-sm text-gray-700 tracking-wider">{child.iin || <span className="text-gray-400 tracking-normal">Не указан</span>}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 col-span-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Катался на лыжах или обучался</p>
          <p className="text-sm text-gray-700">
            {child.skiExperience?.hasExperience === true && <>Да — <span className="font-medium">{child.skiExperience.when}</span></>}
            {child.skiExperience?.hasExperience === false && 'Нет'}
            {typeof child.skiExperience?.hasExperience !== 'boolean' && <span className="text-gray-400">Не указано</span>}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 col-span-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Адаптивное катание</p>
          <p className="text-sm text-gray-700">
            {child.adaptiveSkating?.hasExperience === true && <>Да — <span className="font-medium">{child.adaptiveSkating.when}</span></>}
            {child.adaptiveSkating?.hasExperience === false && 'Не проходил'}
            {typeof child.adaptiveSkating?.hasExperience !== 'boolean' && <span className="text-gray-400">Не указано</span>}
          </p>
          {child.adaptiveSkating?.hasExperience && child.adaptiveSkating.details && (
            <p className="text-sm text-gray-600 whitespace-pre-line mt-1">{child.adaptiveSkating.details}</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Диагноз</p>
          <p className="text-sm text-gray-700">{child.diagnosis || <span className="text-gray-400">Не указан</span>}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Способ общения</p>
          <p className="text-sm text-gray-700">{child.communicationMethod || <span className="text-gray-400">Не указан</span>}</p>
        </div>
      </div>
    </div>
  );
}
