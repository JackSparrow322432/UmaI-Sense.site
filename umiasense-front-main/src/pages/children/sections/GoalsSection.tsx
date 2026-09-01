import { useState } from 'react';
import { toast } from 'sonner';
import { childrenApi } from '../../../api';
import type { Child } from '../../../types';

interface Goal { title: string; description?: string; }
interface Props { child: Child; canEdit: boolean; onRefresh: () => void; }

export default function GoalsSection({ child, canEdit, onRefresh }: Props) {
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<Goal>({ title: '', description: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Goal>({ title: '', description: '' });

  const goals = child.goals || [];

  const updateGoals = async (newGoals: Goal[]) => {
    setSaving(true);
    try {
      await childrenApi.update(child._id, { goals: newGoals });
      toast.success('Сохранено');
      onRefresh();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!addForm.title.trim()) { toast.error('Название цели обязательно'); return; }
    await updateGoals([...goals, { title: addForm.title.trim(), description: addForm.description?.trim() || undefined }]);
    setAdding(false);
    setAddForm({ title: '', description: '' });
  };

  const handleEdit = async (i: number) => {
    if (!editForm.title.trim()) { toast.error('Название цели обязательно'); return; }
    const updated = goals.map((g, idx) => idx === i ? { title: editForm.title.trim(), description: editForm.description?.trim() || undefined } : g);
    await updateGoals(updated);
    setEditingIndex(null);
  };

  const handleDelete = async (i: number) => {
    await updateGoals(goals.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Текущие направления работы с ребёнком.</p>
        {canEdit && (
          <button onClick={() => { setAdding(true); setEditingIndex(null); }} className="text-sm text-[#E07628] font-semibold hover:underline">+ Добавить</button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-[#FFF3EA] rounded-xl p-4 space-y-3 border border-[#E07628]/20">
          <input
            type="text"
            value={addForm.title}
            onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Название цели"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition"
          />
          <textarea
            value={addForm.description}
            onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Описание (необязательно)"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setAddForm({ title: '', description: '' }); }} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-semibold">Отмена</button>
            <button onClick={handleAdd} disabled={saving} className="flex-1 bg-[#E07628] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">{saving ? '...' : 'Добавить'}</button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 && !adding ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">🎯</p>
          <p className="text-sm">Цели не добавлены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              {editingIndex === i ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/30 focus:border-[#E07628] transition resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingIndex(null)} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-semibold">Отмена</button>
                    <button onClick={() => handleEdit(i)} disabled={saving} className="flex-1 bg-[#E07628] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">Сохранить</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#FFF3EA] flex items-center justify-center text-[#E07628] font-bold text-sm flex-shrink-0 mt-0.5">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{goal.title}</p>
                    {goal.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{goal.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setEditForm({ title: goal.title, description: goal.description || '' }); setEditingIndex(i); setAdding(false); }} className="text-xs text-[#E07628] hover:underline">Изм.</button>
                      <button onClick={() => handleDelete(i)} className="text-xs text-red-400 hover:underline">Удалить</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
