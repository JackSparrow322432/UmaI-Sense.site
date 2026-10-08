import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { consentsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import type { ConsentType } from '../../types';
import ConsentCheckbox from './ConsentCheckbox';

/**
 * После входа: если у пользователя нет обязательных согласий ТЕКУЩЕЙ редакции политики
 * (политика обновилась или аккаунт создан до появления отдельных согласий), показываем окно
 * с просьбой подтвердить. Без подтверждения работать с данными нельзя — можно только выйти.
 */
export default function ConsentUpdateModal() {
  const { user, clearAuth } = useAuthStore();
  const [missing, setMissing] = useState<ConsentType[]>([]);
  const [askCrossBorder, setAskCrossBorder] = useState(false);
  const [version, setVersion] = useState('');
  const [account, setAccount] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);
  const [crossBorder, setCrossBorder] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    let cancelled = false;
    consentsApi.get()
      .then(({ data }) => {
        if (cancelled) return;
        setMissing(data.missingRequired);
        setAskCrossBorder(!data.active.cross_border);
        setVersion(data.currentVersion);
      })
      .catch(() => { /* не блокируем работу из-за сетевой ошибки — спросим при следующем входе */ });
    return () => { cancelled = true; };
  }, [user]);

  if (!missing.length) return null;

  const needAccount = missing.includes('account');
  const needThird = missing.includes('third_party_transfer');
  const canSave = (!needAccount || account) && (!needThird || thirdParty);

  const save = async () => {
    setSaving(true);
    try {
      const types: ConsentType[] = [...missing];
      if (askCrossBorder && crossBorder) types.push('cross_border');
      await consentsApi.grant(types);
      setMissing([]);
      toast.success('Спасибо! Согласие сохранено');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось сохранить согласие');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4" role="dialog" aria-modal="true" aria-labelledby="consent-update-title">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 id="consent-update-title" className="text-[15px] font-semibold text-gray-900">Обновлена политика конфиденциальности</h3>
          <p className="text-xs text-gray-400 mt-1">Редакция от {version}. Пожалуйста, ознакомьтесь и подтвердите согласия.</p>
        </div>
        <div className="px-6 py-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-gray-600 leading-relaxed">
            Мы добавили отдельные согласия: на передачу данных третьим лицам (тренерам, хостинг-провайдеру, почтовому
            сервису и др.) и — по желанию — на передачу обезличенных данных внешнему сервису ИИ для рекомендаций.
          </p>
          {needAccount && (
            <ConsentCheckbox checked={account} onChange={setAccount} required link={{ to: '/privacy', label: 'Политикой конфиденциальности' }}>
              Я даю согласие на сбор и обработку моих персональных данных в соответствии с
            </ConsentCheckbox>
          )}
          {needThird && (
            <ConsentCheckbox checked={thirdParty} onChange={setThirdParty} required link={{ to: '/privacy#third-parties', label: '(перечень получателей)' }}>
              Я даю согласие на передачу моих данных и данных моих детей третьим лицам, указанным в Политике
            </ConsentCheckbox>
          )}
          {askCrossBorder && user?.role === 'parent' && (
            <ConsentCheckbox checked={crossBorder} onChange={setCrossBorder} link={{ to: '/privacy#cross-border', label: '(подробнее)' }}>
              Я согласен(на) на трансграничную передачу обезличенных сведений о развитии ребёнка (без имени, ИИН,
              даты рождения и документов) внешнему сервису ИИ для персональных рекомендаций
            </ConsentCheckbox>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button
            type="button"
            onClick={() => { clearAuth(); window.location.href = '/login'; }}
            className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition"
          >
            Выйти
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave || saving}
            className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}
