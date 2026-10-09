import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi, uploadApi } from '../../api';
import AdaptiveSkatingFields, {
  emptySkating, validateSkating, skatingPayload, type SkatingForm,
} from '../../components/enrollment/AdaptiveSkatingFields';
import { isValidIin, iinMatchesBirthDate } from '../../utils/enrollment';
import FileDropzone from '../../components/common/FileDropzone';
import { UPLOAD_RULES } from '../../utils/uploadRules';
import ConsentCheckbox from '../../components/legal/ConsentCheckbox';

const COMMUNICATION_OPTIONS = [
  'Вербальная речь', 'ААС-устройство', 'PECS карточки', 'Жестовый язык', 'Другое',
];

const inputClass =
  'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';

const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export default function ChildFormPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', lastName: '', iin: '', dateOfBirth: '', diagnosis: '', communicationMethod: '', photo: '',
  });
  const [skating, setSkating] = useState<SkatingForm>(emptySkating());
  const [consent, setConsent] = useState(false);
  const [consentThirdParty, setConsentThirdParty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await uploadApi.image(file, 'avatar');
      set('photo', data.url);
      toast.success('Фото загружено');
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Ошибка загрузки фото'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.lastName.trim() || !form.dateOfBirth) {
      toast.error('Имя, фамилия и дата рождения обязательны'); return;
    }
    if (!isValidIin(form.iin)) { toast.error('Проверьте ИИН — 12 цифр'); return; }
    const skatingError = validateSkating(skating);
    if (skatingError) { toast.error(skatingError); return; }
    if (!consent) { toast.error('Нужно согласие на обработку данных ребёнка'); return; }
    if (!consentThirdParty) { toast.error('Нужно согласие на передачу данных третьим лицам'); return; }
    setSaving(true);
    try {
      const { data } = await childrenApi.create({
        name: form.name.trim(),
        lastName: form.lastName.trim(),
        iin: form.iin,
        ...skatingPayload(skating),
        consent,
        consentThirdParty,
        dateOfBirth: form.dateOfBirth,
        diagnosis: form.diagnosis.trim() || undefined,
        communicationMethod: form.communicationMethod || undefined,
        photo: form.photo || undefined,
      });
      toast.success('Профиль создан. Теперь выберите удобные дни занятий');
      navigate(`/requests/new?childId=${data._id}`);
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

          {/* Photo upload — рамка с подсказкой о форматах и разрешении */}
          <FileDropzone
            rule={UPLOAD_RULES.avatar}
            variant="avatar"
            title="Фото ребёнка (необязательно)"
            preview={form.photo}
            uploading={uploading}
            onFile={handlePhoto}
          />

          <div className="border-t border-gray-100" />

          {/* Name */}
          <div>
            <label className={labelClass}>Имя <span className="text-[#E07628]">*</span></label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Введите имя" required autoFocus className={inputClass} />
          </div>

          {/* Last name */}
          <div>
            <label className={labelClass}>Фамилия <span className="text-[#E07628]">*</span></label>
            <input type="text" value={form.lastName} onChange={(e) => set('lastName', e.target.value)}
              placeholder="Введите фамилию" required className={inputClass} />
          </div>

          {/* IIN */}
          <div>
            <label className={labelClass}>ИИН ребёнка <span className="text-[#E07628]">*</span></label>
            <input type="text" inputMode="numeric" value={form.iin}
              onChange={(e) => set('iin', e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="12 цифр" required className={inputClass + ' tracking-wider'} />
            {form.iin.length === 12 && !isValidIin(form.iin) && (
              <p className="text-xs text-red-500 mt-1">ИИН не прошёл проверку — проверьте цифры</p>
            )}
            {form.iin.length >= 6 && form.dateOfBirth && !iinMatchesBirthDate(form.iin, form.dateOfBirth) && (
              <p className="text-xs text-amber-600 mt-1">Первые 6 цифр ИИН не совпадают с датой рождения — проверьте</p>
            )}
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

          {/* Лыжи и адаптивное катание — обязательно */}
          <AdaptiveSkatingFields value={skating} onChange={setSkating} />

          {/* Согласие законного представителя (Закон РК «О персональных данных и их защите») */}
          <div className="space-y-2.5">
            <ConsentCheckbox checked={consent} onChange={setConsent} required link={{ to: '/privacy', label: 'Политикой конфиденциальности' }}>
              Как законный представитель ребёнка я даю согласие на сбор и обработку его персональных данных,
              включая ИИН и сведения о здоровье (диагноз, медицинские документы), в целях организации занятий,
              в соответствии с
            </ConsentCheckbox>
            <ConsentCheckbox checked={consentThirdParty} onChange={setConsentThirdParty} required link={{ to: '/privacy#third-parties', label: '(перечень получателей)' }}>
              Я даю согласие на передачу данных ребёнка третьим лицам, указанным в Политике: закреплённым тренерам
              и специалистам, провайдеру хранения данных, государственным органам в случаях, предусмотренных законом
            </ConsentCheckbox>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => navigate('/children')}
              className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
              Отмена
            </button>
            <button type="submit" disabled={saving || uploading || !form.name.trim() || !form.lastName.trim() || !form.dateOfBirth || !isValidIin(form.iin) || !!validateSkating(skating) || !consent || !consentThirdParty}
              className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 shadow-sm">
              {saving ? 'Сохранение...' : 'Создать профиль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
