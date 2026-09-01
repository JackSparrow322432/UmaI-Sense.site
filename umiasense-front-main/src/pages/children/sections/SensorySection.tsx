import { useState } from 'react';
import { toast } from 'sonner';
import { childrenApi } from '../../../api';
import type { Child } from '../../../types';

const SENSES = [
  { key: 'sound', icon: '🔊', label: 'Звук' },
  { key: 'light', icon: '💡', label: 'Свет' },
  { key: 'touch', icon: '🤚', label: 'Прикосновения' },
  { key: 'smell', icon: '👃', label: 'Запах' },
  { key: 'taste',  icon: '👅', label: 'Вкус' },
] as const;

type SenseKey = 'sound' | 'light' | 'touch' | 'smell' | 'taste';

interface Props { child: Child; canEdit: boolean; onRefresh: () => void; }

export default function SensorySection({ child, canEdit, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<SenseKey, string>>({
    sound: child.sensoryProfile?.sound || '',
    light: child.sensoryProfile?.light || '',
    touch: child.sensoryProfile?.touch || '',
    smell: child.sensoryProfile?.smell || '',
    taste: child.sensoryProfile?.taste || '',
  });

  const startEdit = () => {
    setForm({
      sound: child.sensoryProfile?.sound || '',
      light: child.sensoryProfile?.light || '',
      touch: child.sensoryProfile?.touch || '',
      smell: child.sensoryProfile?.smell || '',
      taste: child.sensoryProfile?.taste || '',
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await childrenApi.update(child._id, { sensoryProfile: form });
      toast.success('Сохранено');
      onRefresh();
      setEditing(false);
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Реакция ребёнка на различные сенсорные стимулы.</p>
        {canEdit && !editing && (
          <button onClick={startEdit} className="text-sm text-[#E07628] font-semibold hover:underline">Изменить</button>
        )}
      </div>

      <div className="space-y-3">
        {SENSES.map(({ key, icon, label }) => (
          <div key={key} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span>{icon}</span>
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </div>
            {editing ? (
              <textarea
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={`Опишите реакцию на ${label.toLowerCase()}...`}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition resize-none"
              />
            ) : (
              <p className="text-sm text-gray-600">{child.sensoryProfile?.[key] || <span className="text-gray-400">Не указано</span>}</p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="flex gap-3">
          <button onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition">Отмена</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-[#E07628] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#C4641A] transition disabled:opacity-50">{saving ? 'Сохранение...' : 'Сохранить'}</button>
        </div>
      )}
    </div>
  );
}
