import { useState } from 'react';
import { toast } from 'sonner';
import { activitiesApi } from '../../api';
import type { ActivityCategory } from '../../types';
import ModalShell from './ModalShell';

const CATEGORIES: Record<ActivityCategory, { label: string; color: string; bg: string }> = {
  hobby:   { label: 'Хобби',      color: '#E07628', bg: '#FFF3EA' },
  therapy: { label: 'Терапия',    color: '#2DD4A1', bg: '#EDFAF5' },
  study:   { label: 'Учёба',      color: '#60A5FA', bg: '#EFF6FF' },
  walk:    { label: 'Прогулка',   color: '#34D399', bg: '#ECFDF5' },
  social:  { label: 'Социальное', color: '#F59B56', bg: '#FFF7ED' },
  other:   { label: 'Другое',     color: '#9CA3AF', bg: '#F3F4F6' },
};

const inputClass = 'w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition placeholder-gray-400 text-gray-800';

interface Props {
  childId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddActivityModal({ childId, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Введите название'); return; }
    if (!category) { toast.error('Выберите категорию'); return; }
    setSaving(true);
    try {
      await activitiesApi.add(childId, {
        name: name.trim(), category, date,
        duration: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Активность добавлена');
      onSaved();
      onClose();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title="Новая активность" onClose={onClose}>
      <div className="space-y-4">

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Название <span className="text-[#E07628]">*</span>
          </p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Рисование, логопед, прогулка..." autoFocus className={inputClass} />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Категория <span className="text-[#E07628]">*</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(CATEGORIES) as [ActivityCategory, typeof CATEGORIES[ActivityCategory]][]).map(([key, cfg]) => {
              const selected = category === key;
              return (
                <button key={key} onClick={() => setCategory(key)}
                  className="py-2.5 rounded-xl border-2 text-xs font-semibold transition-all"
                  style={selected
                    ? { borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color }
                    : { borderColor: '#E5E7EB', color: '#6B7280', backgroundColor: '#F9FAFB' }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Дата</p>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]} className={inputClass} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Длительность (мин)</p>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
              placeholder="60" min="1" max="480" className={inputClass} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Заметки <span className="text-gray-300 normal-case font-normal tracking-normal">— необязательно</span>
          </p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Как прошло занятие?" rows={2}
            className={inputClass + ' resize-none'} />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !category}
            className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50 shadow-sm">
            {saving ? 'Сохранение...' : 'Добавить'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
