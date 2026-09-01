import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi, uploadApi } from '../../api';

const COMMUNICATION_OPTIONS = [
  'Вербальная речь', 'ААС-устройство', 'PECS карточки', 'Жестовый язык', 'Другое',
];

const inputClass =
  'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';

const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

const CameraIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export default function ChildFormPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: '', dateOfBirth: '', diagnosis: '', communicationMethod: '', photo: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadApi.image(file);
      set('photo', data.url);
      toast.success('Фото загружено');
    } catch { toast.error('Ошибка загрузки фото'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.dateOfBirth) { toast.error('Имя и дата рождения обязательны'); return; }
    setSaving(true);
    try {
      const { data } = await childrenApi.create({
        name: form.name.trim(),
        dateOfBirth: form.dateOfBirth,
        diagnosis: form.diagnosis.trim() || undefined,
        communicationMethod: form.communicationMethod || undefined,
        photo: form.photo || undefined,
      });
      toast.success('Профиль создан');
      navigate(`/children/${data._id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка сохранения');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/children')}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition"
        >
          <BackIcon />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Новый профиль</h1>
          <p className="text-xs text-gray-400 mt-0.5">Заполните основную информацию</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Photo upload */}
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 hover:border-[#E07628] hover:bg-gray-50 flex items-center justify-center cursor-pointer transition overflow-hidden group"
            >
              {form.photo ? (
                <img src={form.photo} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-gray-300 group-hover:text-[#E07628] transition"><CameraIcon /></span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400">Фото профиля (необязательно)</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <div className="border-t border-gray-100" />

          {/* Name */}
          <div>
            <label className={labelClass}>Имя <span className="text-[#E07628]">*</span></label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Введите имя" required autoFocus className={inputClass} />
          </div>

          {/* DOB */}
          <div>
            <label className={labelClass}>Дата рождения <span className="text-[#E07628]">*</span></label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)}
              max={new Date().toISOString().split('T')[0]} required className={inputClass} />
          </div>

          {/* Diagnosis */}
          <div>
            <label className={labelClass}>
              Диагноз <span className="text-gray-300 normal-case font-normal tracking-normal">— необязательно</span>
            </label>
            <input type="text" value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)}
              placeholder="Например: РАС, ДЦП, синдром Дауна" className={inputClass} />
          </div>

          {/* Communication */}
          <div>
            <label className={labelClass}>
              Способ общения <span className="text-gray-300 normal-case font-normal tracking-normal">— необязательно</span>
            </label>
            <select value={form.communicationMethod} onChange={(e) => set('communicationMethod', e.target.value)}
              className={inputClass + ' cursor-pointer'}>
              <option value="">Выберите вариант...</option>
              {COMMUNICATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => navigate('/children')}
              className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
              Отмена
            </button>
            <button type="submit" disabled={saving || uploading || !form.name.trim() || !form.dateOfBirth}
              className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 shadow-sm">
              {saving ? 'Сохранение...' : 'Создать профиль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
