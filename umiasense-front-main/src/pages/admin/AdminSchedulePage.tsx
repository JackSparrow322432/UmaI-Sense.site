import { useEffect, useState } from 'react';
import { enrollmentApi } from '../../api';
import type { User } from '../../types';
import ScheduleCalendar from '../../components/enrollment/ScheduleCalendar';

export default function AdminSchedulePage() {
  const [trainers, setTrainers] = useState<User[]>([]);
  const [trainerId, setTrainerId] = useState('');

  useEffect(() => {
    enrollmentApi.adminGetTrainers().then(({ data }) => setTrainers(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Расписание</h1>
          <p className="text-sm text-gray-400 mt-1">Все занятия: кто, с кем и когда. Нажмите на день, чтобы отменить занятие.</p>
        </div>
        <select
          value={trainerId}
          onChange={(e) => setTrainerId(e.target.value)}
          className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E07628]/20 focus:border-[#E07628]"
        >
          <option value="">Все тренеры</option>
          {trainers.map((t) => <option key={t._id} value={t._id}>{t.name || t.email}</option>)}
        </select>
      </div>
      <ScheduleCalendar role="admin" trainerId={trainerId || undefined} canCancel />
    </div>
  );
}
