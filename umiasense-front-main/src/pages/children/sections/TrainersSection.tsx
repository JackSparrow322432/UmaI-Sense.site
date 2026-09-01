import { useState } from 'react';
import { toast } from 'sonner';
import { childrenApi, invitesApi } from '../../../api';
import type { Child, User, InviteCode } from '../../../types';
import { useCountdown } from '../../../hooks/useCountdown';

interface Props { child: Child; canEdit: boolean; onRefresh: () => void; }

function InviteCodeBox({ code, onNew }: { code: InviteCode; onNew: () => void }) {
  const remaining = useCountdown(code.expiresAt);
  const expired = remaining === 'Истёк';

  const copy = () => {
    navigator.clipboard.writeText(code.code);
    toast.success('Код скопирован');
  };

  return (
    <div className={`rounded-2xl p-4 border ${expired ? 'bg-gray-50 border-gray-200' : 'bg-[#FFF3EA] border-[#E07628]/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Код-приглашение</p>
        {!expired && (
          <span className="text-xs text-[#E07628] font-medium bg-white rounded-full px-2.5 py-0.5 border border-[#E07628]/20">
            ⏱ {remaining}
          </span>
        )}
        {expired && (
          <span className="text-xs text-gray-400 font-medium">Истёк</span>
        )}
      </div>

      {expired ? (
        <p className="text-sm text-gray-400 mb-3">Срок действия кода истёк. Создайте новый.</p>
      ) : (
        <div className="flex items-center gap-3 mb-3">
          <p className="text-3xl font-bold tracking-widest text-[#E07628] font-mono">{code.code}</p>
          <button
            onClick={copy}
            className="text-xs bg-white border border-[#E07628]/30 text-[#E07628] rounded-lg px-3 py-1.5 font-semibold hover:bg-[#E07628] hover:text-white transition"
          >
            Копировать
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3">
        {expired
          ? ''
          : 'Отправьте этот код тренеру. Он действителен 48 часов.'}
      </p>

      <button
        onClick={onNew}
        className="text-xs text-[#E07628] font-semibold hover:underline"
      >
        {expired ? 'Создать новый код' : '↺ Создать новый код'}
      </button>
    </div>
  );
}

export default function TrainersSection({ child, canEdit, onRefresh }: Props) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeCode, setActiveCode] = useState<InviteCode | null>(null);

  const trainers = child.trainers as User[];

  const handleCreateCode = async () => {
    setCreating(true);
    try {
      const { data } = await invitesApi.create(child._id);
      setActiveCode(data);
      toast.success('Код создан');
    } catch {
      toast.error('Ошибка создания кода');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (trainerId: string) => {
    if (!confirm('Отозвать доступ тренера?')) return;
    setRevoking(trainerId);
    try {
      await childrenApi.removeTrainer(child._id, trainerId);
      toast.success('Доступ отозван');
      onRefresh();
    } catch {
      toast.error('Ошибка');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-5">

      {/* Invite code block — parent only */}
      {canEdit && (
        <div>
          {activeCode ? (
            <InviteCodeBox code={activeCode} onNew={handleCreateCode} />
          ) : (
            <button
              onClick={handleCreateCode}
              disabled={creating}
              className="w-full border-2 border-dashed border-[#E07628]/30 rounded-2xl py-4 text-sm font-semibold text-[#E07628] hover:bg-[#FFF3EA] transition disabled:opacity-50"
            >
              {creating ? 'Создание...' : '🔗 Создать код-приглашение для тренера'}
            </button>
          )}
        </div>
      )}

      {/* Trainers list */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Прикреплённые специалисты
        </p>

        {trainers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm">Нет прикреплённых специалистов</p>
            {canEdit && <p className="text-xs mt-1">Создайте код выше и отправьте тренеру</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {trainers.map((trainer) => (
              <div key={trainer._id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-[#EDFAF5] flex items-center justify-center text-lg font-bold text-[#2DD4A1] flex-shrink-0 overflow-hidden">
                  {trainer.photo
                    ? <img src={trainer.photo} className="w-full h-full object-cover" alt="" />
                    : trainer.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{trainer.name || 'Без имени'}</p>
                  <p className="text-xs text-gray-400">{trainer.email}</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRevoke(trainer._id)}
                    disabled={revoking === trainer._id}
                    className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50 transition"
                  >
                    {revoking === trainer._id ? '...' : 'Отозвать'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
