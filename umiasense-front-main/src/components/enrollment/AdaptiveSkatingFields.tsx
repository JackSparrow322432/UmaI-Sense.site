import type { AdaptiveSkating, Child, SkiExperience } from '../../types';

/**
 * Два обязательных вопроса анкеты ребёнка:
 *  1. Катался ли ребёнок когда-либо на лыжах или обучался — и когда именно.
 *  2. Проходил ли адаптивное катание — и в какие даты.
 */
export type SkatingForm = {
  ski: boolean | null;
  skiWhen: string;
  adaptive: boolean | null;
  adaptiveDates: string;
  adaptiveDetails: string;
};

export const emptySkating = (c?: Pick<Child, 'adaptiveSkating' | 'skiExperience'>): SkatingForm => ({
  ski: typeof c?.skiExperience?.hasExperience === 'boolean' ? c.skiExperience.hasExperience : null,
  skiWhen: c?.skiExperience?.when ?? '',
  adaptive: typeof c?.adaptiveSkating?.hasExperience === 'boolean' ? c.adaptiveSkating.hasExperience : null,
  adaptiveDates: c?.adaptiveSkating?.when ?? '',
  adaptiveDetails: c?.adaptiveSkating?.details ?? '',
});

/** Возвращает текст ошибки или null */
export const validateSkating = (f: SkatingForm): string | null => {
  if (f.ski === null) return 'Ответьте, катался ли ребёнок когда-либо на лыжах или обучался';
  if (f.ski && !f.skiWhen.trim()) return 'Укажите, когда именно ребёнок катался на лыжах';
  if (f.adaptive === null) return 'Ответьте, проходил ли ребёнок адаптивное катание';
  if (f.adaptive && !f.adaptiveDates.trim()) return 'Укажите даты, когда ребёнок проходил адаптивное катание';
  return null;
};

export const skatingPayload = (f: SkatingForm): { skiExperience: SkiExperience; adaptiveSkating: AdaptiveSkating } => ({
  skiExperience: {
    hasExperience: !!f.ski,
    ...(f.ski ? { when: f.skiWhen.trim() } : {}),
  },
  adaptiveSkating: {
    hasExperience: !!f.adaptive,
    ...(f.adaptive
      ? { when: f.adaptiveDates.trim(), ...(f.adaptiveDetails.trim() ? { details: f.adaptiveDetails.trim() } : {}) }
      : {}),
  },
});

const inputClass =
  'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';

const Req = () => <span className="text-[#E07628]">*</span>;

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { v: true, label: 'Да' },
        { v: false, label: 'Нет' },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`rounded-xl border py-2.5 text-sm font-medium transition ${
            value === o.v
              ? 'border-[#E07628] bg-[#FFF3EA] text-[#E07628]'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface Props {
  value: SkatingForm;
  onChange: (v: SkatingForm) => void;
}

export default function AdaptiveSkatingFields({ value, onChange }: Props) {
  const set = (patch: Partial<SkatingForm>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-5">
      {/* 1. Лыжи */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          Ваш ребёнок когда-либо катался на лыжах или обучался? <Req />
        </p>
        <YesNo value={value.ski} onChange={(v) => set({ ski: v })} />
        {value.ski && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Когда именно? <Req />
            </label>
            <input
              type="text"
              value={value.skiWhen}
              onChange={(e) => set({ skiWhen: e.target.value })}
              maxLength={300}
              placeholder="Например: зима 2023, 5 занятий в Шымбулаке"
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* 2. Адаптивное катание */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          Проходил ли ребёнок адаптивное катание? <Req />
        </p>
        <YesNo value={value.adaptive} onChange={(v) => set({ adaptive: v })} />
        {value.adaptive && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Какие даты? <Req />
              </label>
              <input
                type="text"
                value={value.adaptiveDates}
                onChange={(e) => set({ adaptiveDates: e.target.value })}
                maxLength={300}
                placeholder="Например: 10.01.2025 – 28.02.2025"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Подробности (необязательно)</label>
              <textarea
                value={value.adaptiveDetails}
                onChange={(e) => set({ adaptiveDetails: e.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="Где занимался, с каким тренером, как часто, чему научился"
                className={inputClass + ' resize-none'}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
