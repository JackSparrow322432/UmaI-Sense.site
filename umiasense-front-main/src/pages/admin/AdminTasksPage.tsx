// ФАЙЛ: umiasense-front-main/src/pages/admin/AdminTasksPage.tsx
// ПОЛНАЯ ЗАМЕНА ФАЙЛА

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tasksApi } from '../../api';
import type { Task } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminTasksPage() {
  const navigate = useNavigate();
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    tasksApi.getAll()
      .then(({ data }) => setTasks(data))
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить задание «${title}»? Также будут удалены все оценки по нему.`)) return;
    setDeleting(id);
    try {
      await tasksApi.delete(id);
      setTasks((prev) => prev.filter((t) => t._id !== id));
      toast.success('Задание удалено');
    } catch { toast.error('Ошибка удаления'); }
    finally { setDeleting(null); }
  };

  const handleTogglePublish = async (task: Task) => {
    setToggling(task._id);
    try {
      const { data } = await tasksApi.update(task._id, { published: !task.published });
      setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, ...data } : t));
      toast.success(data.published ? 'Задание опубликовано' : 'Задание снято с публикации');
    } catch { toast.error('Ошибка'); }
    finally { setToggling(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const published = tasks.filter((t) => t.published).length;
  const drafts     = tasks.length - published;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Задания</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-green-50 text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {published} опубликовано
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">
              {drafts} черновиков
            </span>
          </div>
        </div>
        <Link
          to="/admin/tasks/new"
          className="flex-shrink-0 inline-flex items-center gap-2 bg-[#E07628] hover:bg-[#C4641A] active:scale-[0.97] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Новое задание
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[3fr_1fr_1.1fr_auto] px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <span className="text-xs font-medium text-gray-500">Задание</span>
          <span className="text-xs font-medium text-gray-500">Статус</span>
          <span className="text-xs font-medium text-gray-500">Дата</span>
          <span className="text-xs font-medium text-gray-500">Действия</span>
        </div>

        {tasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFF3EA] mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Заданий пока нет</p>
            <p className="text-xs text-gray-400 mb-5">Создайте первое задание для родителей</p>
            <Link
              to="/admin/tasks/new"
              className="inline-flex items-center gap-1.5 bg-[#E07628] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#C4641A] transition-all"
            >
              Создать задание
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tasks.map((task) => (
              <div
                key={task._id}
                className="flex flex-col sm:grid sm:grid-cols-[3fr_1fr_1.1fr_auto] items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 w-full">
                  {task.coverImage ? (
                    <img src={task.coverImage} className="w-14 h-11 rounded-xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-14 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1 leading-snug">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                    task.published ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {task.published ? 'Опубликовано' : 'Черновик'}
                  </span>
                </div>

                <div className="hidden sm:block">
                  <span className="text-xs text-gray-400">
                    {task.published && task.publishedAt
                      ? formatDate(task.publishedAt)
                      : formatDate(task.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <button
                    onClick={() => navigate(`/admin/tasks/${task._id}/submissions`)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] transition-all whitespace-nowrap"
                    title="Проверить домашние задания и выставить оценки"
                  >
                    Проверка
                  </button>
                  <button
                    onClick={() => handleTogglePublish(task)}
                    disabled={toggling === task._id}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 whitespace-nowrap ${
                      task.published
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {toggling === task._id ? '...' : task.published ? 'Скрыть' : 'Опубликовать'}
                  </button>
                  <button
                    onClick={() => navigate(`/admin/tasks/${task._id}/edit`)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF3EA] text-[#E07628] hover:bg-[#FFE8D0] transition-all whitespace-nowrap"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(task._id, task.title)}
                    disabled={deleting === task._id}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all disabled:opacity-50 flex-shrink-0"
                    title="Удалить"
                  >
                    {deleting === task._id ? (
                      <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tasks.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">Всего {tasks.length} заданий</p>
          </div>
        )}
      </div>
    </div>
  );
}
