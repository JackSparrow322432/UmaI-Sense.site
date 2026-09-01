import { useState } from 'react';
import { toast } from 'sonner';
import { childrenApi } from '../../../api';
import type { Child } from '../../../types';
import TagInput from '../../../components/common/TagInput';

interface Props { child: Child; canEdit: boolean; onRefresh: () => void; }

export default function InterestsSection({ child, canEdit, onRefresh }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interests, setInterests] = useState<string[]>(child.interests || []);
  const [calming, setCalming] = useState<string[]>(child.calmingActivities || []);

  const startEdit = () => {
    setInterests(child.interests || []);
    setCalming(child.calmingActivities || []);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await childrenApi.update(child._id, { interests, calmingActivities: calming });
      toast.success('Сохранено');
      onRefresh();
      setEditing(false);
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Что нравится ребёнку и что его успокаивает.</p>
        {canEdit && !editing && (
          <button onClick={startEdit} className="text-sm text-[#E07628] font-semibold hover:underline">Изменить</button>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">⭐ Интересы и любимые темы</label>
        <TagInput value={editing ? interests : (child.interests || [])} onChange={setInterests} placeholder="Динозавры, рисование..." disabled={!editing} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🧘 Что успокаивает</label>
        <TagInput value={editing ? calming : (child.calmingActivities || [])} onChange={setCalming} placeholder="Музыка, прогулка..." disabled={!editing} />
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
