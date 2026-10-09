import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { consentsApi } from '../../api';
import type { ConsentStatus, ConsentType } from '../../types';
import { useAuthStore } from '../../store/authStore';

const LABELS: Record<ConsentType, string> = {
  account: 'Обработка моих персональных данных',
  child_data: 'Обработка данных ребёнка',
  third_party_transfer: 'Передача третьим лицам из Политики',
  cross_border: 'Трансграничная передача обезличенных данных внешнему ИИ',
  ai_screening: 'ИИ-скрининг профиля ребёнка',
  documents_ai: 'Анализ медицинских документов ИИ (расшифровка, учёт в советах и досье)',
};

const OPTIONAL: ConsentType[] = ['cross_border', 'ai_screening', 'documents_ai'];

const fmt = (d: string) => new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Раздел «Мои согласия» в настройках: история согласий, выдача и отзыв необязательных */
export default function MyConsents() {
  const role = useAuthStore((s) => s.user?.role);
  const [data, setData] = useState<ConsentStatus | null>(null);
  const [busy, setBusy] = useState<ConsentType | null>(null);

  const load = () => consentsApi.get().then(({ data }) => setData(data)).catch(() => toast.error('Не удалось загрузить согласия'));
  useEffect(() => { void load(); }, []);

  const toggle = async (type: ConsentType, on: boolean) => {
    const WARN: Partial<Record<ConsentType, string>> = {
      cross_border: 'Отозвать согласие? Персональные ИИ-рекомендации и ИИ-скрининг станут недоступны, вместо них будут общие советы.',
      ai_screening: 'Отозвать согласие на ИИ-скрининг? Новые скрининги будут недоступны.',
      documents_ai: 'Отозвать согласие? Документы больше не будут передаваться в ИИ, а расшифровки перестанут учитываться в советах.',
    };
    if (!on && !confirm(WARN[type] ?? 'Отозвать согласие?')) return;
    setBusy(type);
    try {
      if (on) await consentsApi.grant([type]);
      else await consentsApi.withdraw(type);
      toast.success(on ? 'Согласие дано' : 'Согласие отозвано');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка');
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <p className="text-xs text-gray-400">Загрузка…</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {/* Необязательные согласия касаются данных детей — актуальны только для родителя */}
        {(role === 'parent' ? OPTIONAL : []).map((t) => {
          const on = data.active[t as keyof ConsentStatus['active']];
          return (
            <div key={t} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-gray-800">{LABELS[t]}</p>
                <p className={`text-xs ${on ? 'text-emerald-600' : 'text-gray-400'}`}>{on ? 'Действует' : 'Не дано / отозвано'}</p>
              </div>
              <button
                type="button"
                disabled={busy === t}
                onClick={() => toggle(t, !on)}
                className={`shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 transition disabled:opacity-50 ${on ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-white bg-[#E07628] hover:bg-[#C4641A]'}`}
              >
                {busy === t ? '…' : on ? 'Отозвать' : 'Дать согласие'}
              </button>
            </div>
          );
        })}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">История согласий ({data.consents.length})</summary>
        <ul className="mt-2 space-y-1.5">
          {data.consents.map((c) => (
            <li key={c._id} className="flex flex-wrap gap-x-2 text-gray-600">
              <span className="font-medium text-gray-700">{LABELS[c.type]}</span>
              {c.childId && <span>· {c.childId.name} {c.childId.lastName ?? ''}</span>}
              <span className="text-gray-400">· {fmt(c.createdAt)} · ред. {c.version}</span>
              {c.withdrawnAt && <span className="text-red-500">· отозвано {fmt(c.withdrawnAt)}</span>}
            </li>
          ))}
        </ul>
      </details>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Обязательные согласия (обработка данных и передача третьим лицам) отзываются удалением профиля ребёнка или
        аккаунта либо письмом оператору — см. <Link to="/privacy#rights" className="underline">Политику</Link>.
      </p>
    </div>
  );
}
