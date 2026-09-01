import { useState } from 'react';
import { toast } from 'sonner';
import { emotionsApi } from '../../api';
import type { MoodType } from '../../types';
import ModalShell from './ModalShell';

const MOODS: Record<MoodType, { label: string; icon: string; color: string; bg: string }> = {
  calm:        { label: 'Спокойный',     icon: '😌', color: '#60A5FA', bg: '#EFF6FF' },
  happy:       { label: 'Радостный',     icon: '😊', color: '#FBBF24', bg: '#FFFBEB' },
  anxious:     { label: 'Тревожный',     icon: '😰', color: '#FB923C', bg: '#FFF7ED' },
  overwhelmed: { label: 'Перегруженный', icon: '😤', color: '#F87171', bg: '#FEF2F2' },
  sad:         { label: 'Грустный',      icon: '😢', color: '#A78BFA', bg: '#F5F3FF' },
  angry:       { label: 'Злой',          icon: '😠', color: '#EF4444', bg: '#FFF1F2' },
  excited:     { label: 'Возбуждённый',  icon: '🤩', color: '#2DD4A1', bg: '#EDFAF5' },
};

const MOOD_KEYS = Object.keys(MOODS) as MoodType[];

interface Props {
  childId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddEmotionModal({ childId, onClose, onSaved }: Props) {
  const [mood, setMood] = useState<MoodType | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mood) { toast.error('Выберите настроение'); return; }
    setSaving(true);
    try {
      await emotionsApi.add(childId, { mood, intensity, comment: comment.trim() || undefined });
      toast.success('Настроение записано');
      onSaved();
      onClose();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title="Записать настроение" onClose={onClose}>
      <div className="space-y-5">

        {/* Mood grid */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Настроение</p>
          <div className="grid grid-cols-4 gap-2">
            {MOOD_KEYS.map((m) => {
              const cfg = MOODS[m];
              const selected = mood === m;
              return (
                <button
                  key={m} onClick={() => setMood(m)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all"
                  style={selected
                    ? { borderColor: cfg.color, backgroundColor: cfg.bg }
                    : { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                >
                  <span className="text-2xl leading-none">{cfg.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 leading-tight text-center px-1">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensity */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Интенсивность — <span className="text-gray-700">{intensity} / 5</span>
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setIntensity(n)}
                className={`flex-1 h-10 rounded-xl font-bold text-sm transition-all border-2 ${
                  intensity >= n
                    ? 'bg-[#E07628] border-[#E07628] text-white'
                    : 'border-gray-200 text-gray-400 bg-gray-50 hover:border-[#E07628]/40'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Комментарий <span className="text-gray-300 normal-case font-normal tracking-normal">— необязательно</span>
          </p>
          <textarea
            value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Что происходило? Что могло повлиять?"
            rows={2}
            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628] transition resize-none placeholder-gray-400"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-500 rounded-xl py-3 text-sm font-semibold hover:bg-gray-50 transition">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !mood}
            className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50 shadow-sm">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
