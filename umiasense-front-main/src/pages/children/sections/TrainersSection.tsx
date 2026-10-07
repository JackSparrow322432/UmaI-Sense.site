import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi } from '../../../api';
import type { Child, User } from '../../../types';

interface Props { child: Child; canEdit: boolean; onRefresh: () => void; }

/**
 * Тренеров к ребёнку записывает администратор по заявке родителя.
 * Тренер получает код доступа и после его ввода появляется в этом списке.
 */
export default function TrainersSection({ child, canEdit, onRefresh }: Props) {
  const trainers = child.trainers as User[];
  const managed = new Set(child.managedTrainerIds ?? []);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Открепить можно только тренера, подключённого по старому коду от родителя.
  // Записанных администратором открепляет администратор (кнопка «Отменить» в заявке).
  const handleRevoke = async (trainerId: string) => {
    if (!confirm('Отозвать доступ тренера?')) return;
    setRevoking(trainerId);
    try {
      await childrenApi.removeTrainer(child._id, trainerId);
      toast.success('Доступ отозван');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-2xl p-4 border bg-[#FFF3EA] border-[#E07628]/20 text-sm text-gray-700">
          <p>Тренера назначает администратор. Отправьте заявку с удобными днями — после записи тренер получит код доступа к профилю.</p>
          <div className="flex gap-4 mt-3">
            <Link to={`/requests/new?childId=${child._id}`} className="text-[#E07628] font-semibold hover:underline">Подать заявку</Link>
            <Link to="/requests" className="text-gray-500 font-medium hover:underline">Мои заявки</Link>
            <Link to="/schedule" className="text-gray-500 font-medium hover:underline">Расписание</Link>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Прикреплённые специалисты</p>

        {trainers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm">Нет прикреплённых специалистов</p>
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
                  {trainer.email && <p className="text-xs text-gray-400">{trainer.email}</p>}
                  {managed.has(trainer._id) && <p className="text-xs text-gray-400">Записан администратором</p>}
                </div>
                {canEdit && !managed.has(trainer._id) && (
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
