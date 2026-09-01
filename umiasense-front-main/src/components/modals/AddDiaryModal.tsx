import { useState } from 'react';
import { toast } from 'sonner';
import { diaryApi } from '../../api';
import type { DiaryTag } from '../../types';
import ModalShell from './ModalShell';

const TAGS: Record<DiaryTag, { label: string; desc: string; color: string; bg: string }> = {
  trigger:  { label: 'Триггер',    desc: 'Вызвал реакцию',  color: '#EF4444', bg: '#FEF2F2' },
  mood:     { label: 'Настроение', desc: 'Эмоциональное',   color: '#60A5FA', bg: '#EFF6FF' },
  info:     { label: 'Заметка',    desc: 'Общая запись',    color: '#9CA3AF', bg: '#F3F4F6' },
  progress: { label: 'Прогресс',   desc: 'Достижение',      color: '#2DD4A1', bg: '#EDFAF5' },
};

const TAG_KEYS = Object.keys(TAGS) as DiaryTag[];

interface Props {
  childId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddDiaryModal({ childId, onClose, onSaved }: Props) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState<DiaryTag | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) { toast.error('Введите текст'); return; }
    if (!tag) { toast.error('Выберите тип записи'); return; }
    setSaving(true);
    try {
      await diaryApi.add(childId, { text: text.trim(), tag });
      toast.success('Запись добавлена');
      onSaved();
      onClose();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title="Запись в дневник" onClose={onClose}>
      <div className="space-y-5">

        {/* Text */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Запись <span className="text-[#E07628]">*</span>
          </p>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Опишите что произошло, как вёл себя ребёнок, что сработало..."
            rows={4} autoFocus
            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition resize-none placeholder-gray-400 text-gray-800"
          />
        </div>

        {/* Tag */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Тип записи <span className="text-[#E07628]">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TAG_KEYS.map((t) => {
              const cfg = TAGS[t];
              const selected = tag === t;
              return (
                <button
                  key={t} onClick={() => setTag(t)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all text-left"
                  style={selected
                    ? { borderColor: cfg.color, backgroundColor: cfg.bg }
                    : { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{cfg.label}</p>
                    <p className="text-[10px] text-gray-400">{cfg.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !text.trim() || !tag}
            className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50 shadow-sm">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
