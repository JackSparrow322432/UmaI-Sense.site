import ScheduleCalendar from '../../components/enrollment/ScheduleCalendar';
import { useAuthStore } from '../../store/authStore';

export default function SchedulePage() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'parent';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Расписание</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {role === 'trainer'
            ? 'Ваши занятия с учениками. Новые ученики появятся после ввода кода доступа.'
            : 'Занятия ваших детей, назначенные администратором.'}
        </p>
      </div>
      <ScheduleCalendar role={role} />
    </div>
  );
}
