import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { tasksApi } from '../../api';
import type { Task } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      to={`/tasks/${task._id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 active:scale-[0.98] transition-all"
    >
      {task.coverImage ? (
        <img src={task.coverImage} className="w-full h-44 object-cover" alt="" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-[#FFF3EA] to-[#FFF8F2] flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F59B56" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
      )}
      <div className="p-4">
        <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{task.title}</p>
        {task.description && (
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{task.description}</p>
        )}
        <p className="text-[10px] text-gray-300 mt-2.5">
          {task.publishedAt ? formatDate(task.publishedAt) : formatDate(task.createdAt)}
        </p>
      </div>
    </Link>
  );
}

export default function TasksPage() {
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.getAll()
      .then(({ data }) => setTasks(data))
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Задания</h1>
        <p className="text-sm text-gray-400 mt-0.5">Задания для ребёнка и оценка их выполнения</p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFF3EA] mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Заданий пока нет</p>
          <p className="text-xs text-gray-400">Здесь будут появляться задания от команды UmaiSense</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((t) => <TaskCard key={t._id} task={t} />)}
        </div>
      )}
    </div>
  );
}
