import type { AdaptiveSkating } from '../../types';

export type SkatingForm = { hasExperience: boolean | null; when: string; details: string };

export const emptySkating = (a?: AdaptiveSkating): SkatingForm => ({
  hasExperience: typeof a?.hasExperience === 'boolean' ? a.hasExperience : null,
  when: a?.when ?? '',
  details: a?.details ?? '',
});

/** Возвращает текст ошибки или null */
export const validateSkating = (f: SkatingForm): string | null => {
  if (f.hasExperience === null) return 'Укажите, был ли ребёнок ранее на адаптивном катании';
  if (f.hasExperience && !f.when.trim()) return 'Укажите, когда ребёнок занимался адаптивным катанием';
  if (f.hasExperience && !f.details.trim()) return 'Опишите подробности занятий адаптивным катанием';
  return null;
};

export const skatingPayload = (f: SkatingForm): AdaptiveSkating => ({
  hasExperience: !!f.hasExperience,
  ...(f.hasExperience ? { when: f.when.trim(), details: f.details.trim() } : {}),
});

const inputClass =
  'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';

interface Props {
  value: SkatingForm;
  onChange: (v: SkatingForm) => void;
}

export default function AdaptiveSkatingFields({ value, onChange }: Props) {
  const set = (patch: Partial<SkatingForm>) => onChange({ ...value, ...patch });

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-xs font-medium text-gray-500">
        Был ли ребёнок ранее на адаптивном катании? <span className="text-[#E07628]">*</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, label: 'Да, занимался' },
          { v: false, label: 'Нет, впервые' },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => set({ hasExperience: o.v })}
            className={`rounded-xl border py-2.5 text-sm font-medium transition ${
              value.hasExperience === o.v
                ? 'border-[#E07628] bg-[#FFF3EA] text-[#E07628]'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {value.hasExperience && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Когда <span className="text-[#E07628]">*</span>
            </label>
            <input
              type="text"
              value={value.when}
              onChange={(e) => set({ when: e.target.value })}
              placeholder="Например: сентябрь 2024 – май 2025"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Подробности <span className="text-[#E07628]">*</span>
            </label>
            <textarea
              value={value.details}
              onChange={(e) => set({ details: e.target.value })}
              rows={3}
              placeholder="Где занимался, с каким тренером, как часто, чему научился, как реагировал на лёд"
              className={inputClass + ' resize-none'}
            />
          </div>
        </>
      )}
    </div>
  );
}
