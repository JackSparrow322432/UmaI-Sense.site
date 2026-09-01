import { useState } from 'react';
import { toast } from 'sonner';
import { childrenApi } from '../../../api';
import type { Child } from '../../../types';

interface Props { child: Child; canEdit: boolean; onRefresh: () => void; }

export default function BehavioralSection({ child, canEdit, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(child.behavioralNotes || '');

  const startEdit = () => {
    setNotes(child.behavioralNotes || '');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await childrenApi.update(child._id, { behavioralNotes: notes.trim() || undefined });
      toast.success('Сохранено');
      onRefresh();
      setEditing(false);
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Важные особенности поведения для специалистов.</p>
        {canEdit && !editing && (
          <button onClick={startEdit} className="text-sm text-[#E07628] font-semibold hover:underline">Изменить</button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Опишите поведенческие особенности ребёнка, которые важно знать специалистам..."
            rows={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition resize-none"
          />
          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition">Отмена</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-[#E07628] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#C4641A] transition disabled:opacity-50">{saving ? 'Сохранение...' : 'Сохранить'}</button>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 min-h-[80px]">
          {child.behavioralNotes ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{child.behavioralNotes}</p>
          ) : (
            <p className="text-sm text-gray-400">Не указано</p>
          )}
        </div>
      )}
    </div>
  );
}
