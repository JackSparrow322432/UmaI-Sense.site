import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tasksApi, childrenApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import type { Task, TaskRating, Child } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="p-0.5 disabled:opacity-50"
        >
          <svg
            width="26" height="26" viewBox="0 0 24 24"
            fill={n <= value ? '#E07628' : 'none'}
            stroke={n <= value ? '#E07628' : '#D1D5DB'}
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function ChildRatingRow({
  taskId,
  child,
  rating,
  onSaved,
}: {
  taskId: string;
  child: Child;
  rating?: TaskRating;
  onSaved: (r: TaskRating) => void;
}) {
  const [value,   setValue]   = useState(rating?.rating ?? 0);
  const [comment, setComment] = useState(rating?.comment ?? '');
  const [saving,  setSaving]  = useState(false);
  const [editingComment, setEditingComment] = useState(false);

  const handleRate = async (n: number) => {
    setValue(n);
    setSaving(true);
    try {
      const { data } = await tasksApi.setRating(taskId, child._id, { rating: n, comment });
      onSaved(data);
      toast.success(`Оценка сохранена: ${n} из 5`);
    } catch {
      toast.error('Не удалось сохранить оценку');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveComment = async () => {
    if (!value) { toast.error('Сначала поставьте оценку'); return; }
    setSaving(true);
    try {
      const { data } = await tasksApi.setRating(taskId, child._id, { rating: value, comment });
      onSaved(data);
      setEditingComment(false);
      toast.success('Комментарий сохранён');
    } catch {
      toast.error('Не удалось сохранить комментарий');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-gray-800">{child.name}</p>
        <StarRating value={value} onChange={handleRate} disabled={saving} />
      </div>

      {editingComment ? (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий к выполнению (необязательно)"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#E07628] transition-colors resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveComment}
              disabled={saving}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#E07628] text-white hover:bg-[#C4641A] transition disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              onClick={() => { setEditingComment(false); setComment(rating?.comment ?? ''); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {comment ? (
            <p className="text-xs text-gray-500 leading-relaxed flex-1">{comment}</p>
          ) : (
            <p className="text-xs text-gray-300 flex-1">Без комментария</p>
          )}
          <button
            onClick={() => setEditingComment(true)}
            className="text-[11px] font-semibold text-[#E07628] hover:underline flex-shrink-0"
          >
            {comment ? 'Изменить' : 'Добавить комментарий'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [task,     setTask]     = useState<Task | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [ratings,  setRatings]  = useState<TaskRating[]>([]);
  const [loading,  setLoading]  = useState(true);

  const canRate = user?.role === 'parent' || user?.role === 'trainer';

  useEffect(() => {
    if (!id) return;
    const loaders: Promise<any>[] = [
      tasksApi.getOne(id).then(({ data }) => setTask(data)),
    ];
    if (canRate) {
      loaders.push(childrenApi.getAll().then(({ data }) => setChildren(data)));
      loaders.push(tasksApi.getRatings(id).then(({ data }) => setRatings(data)));
    }
    Promise.all(loaders)
      .catch(() => { toast.error('Задание не найдено'); navigate('/tasks'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleRatingSaved = (updated: TaskRating) => {
    setRatings((prev) => {
      const exists = prev.some((r) => r.childId === updated.childId);
      return exists
        ? prev.map((r) => (r.childId === updated.childId ? updated : r))
        : [...prev, updated];
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="pb-20">
      <button
        onClick={() => navigate('/tasks')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition mb-5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Все задания
      </button>

      {task.coverImage && (
        <div className="w-full h-52 rounded-2xl overflow-hidden mb-5 shadow-sm">
          <img src={task.coverImage} className="w-full h-full object-cover" alt="" />
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 leading-snug">{task.title}</h1>
        <p className="text-xs text-gray-400 mt-2">
          {task.publishedAt ? formatDate(task.publishedAt) : formatDate(task.createdAt)}
        </p>
        {task.description && (
          <p className="text-sm text-gray-500 mt-3 leading-relaxed border-l-2 border-[#E07628] pl-3">
            {task.description}
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-sm text-gray-700 leading-[1.8] whitespace-pre-wrap">{task.content}</p>
      </div>

      {canRate && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Оценка выполнения</h2>
            <p className="text-xs text-gray-400 mt-0.5">Поставьте оценку от 1 до 5 за каждого ребёнка</p>
          </div>

          {children.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-8 text-center">
              <p className="text-xs text-gray-400">Нет доступных детей для оценки</p>
            </div>
          ) : (
            <div className="space-y-3">
              {children.map((child) => (
                <ChildRatingRow
                  key={child._id}
                  taskId={task._id}
                  child={child}
                  rating={ratings.find((r) => r.childId === child._id)}
                  onSaved={handleRatingSaved}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
