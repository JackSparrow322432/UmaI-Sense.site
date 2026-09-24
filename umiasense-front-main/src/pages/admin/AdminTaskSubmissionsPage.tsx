import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tasksApi } from '../../api';
import type { Task, TaskSubmissionAdmin } from '../../types';

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
            width="24" height="24" viewBox="0 0 24 24"
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

function SubmissionRow({
  taskId,
  item,
  onSaved,
}: {
  taskId: string;
  item: TaskSubmissionAdmin;
  onSaved: (r: TaskSubmissionAdmin) => void;
}) {
  const [value,   setValue]   = useState(item.rating ?? 0);
  const [comment, setComment] = useState(item.comment ?? '');
  const [saving,  setSaving]  = useState(false);
  const [editingComment, setEditingComment] = useState(false);

  const handleRate = async (n: number) => {
    setValue(n);
    setSaving(true);
    try {
      const { data } = await tasksApi.setRating(taskId, item.childId._id, { rating: n, comment });
      onSaved({ ...item, rating: data.rating, comment: data.comment });
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
      const { data } = await tasksApi.setRating(taskId, item.childId._id, { rating: value, comment });
      onSaved({ ...item, rating: data.rating, comment: data.comment });
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
        <div className="flex items-center gap-3 min-w-0">
          {item.childId.photo ? (
            <img src={item.childId.photo} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-500">
              {item.childId.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{item.childId.name}</p>
            {item.childId.parentId?.name && (
              <p className="text-[11px] text-gray-400 truncate">Родитель: {item.childId.parentId.name}</p>
            )}
          </div>
        </div>
        <StarRating value={value} onChange={handleRate} disabled={saving} />
      </div>

      <div className="border-t border-gray-50 pt-3">
        {item.submissionUrl ? (
          <div className="flex items-center gap-3">
            <a href={item.submissionUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
              <img src={item.submissionUrl} className="w-16 h-16 rounded-lg object-cover border border-gray-200" alt="" />
            </a>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">
                {item.submissionFileName || 'Выполненное задание'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {item.submittedAt ? `Загружено ${formatDate(item.submittedAt)}` : 'Загружено'} · нажмите на превью, чтобы открыть в полном размере
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-300">Домашнее задание ещё не загружено</p>
        )}
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
              onClick={() => { setEditingComment(false); setComment(item.comment ?? ''); }}
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

export default function AdminTaskSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task,    setTask]    = useState<Task | null>(null);
  const [items,   setItems]   = useState<TaskSubmissionAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      tasksApi.getOne(id).then(({ data }) => setTask(data)),
      tasksApi.getAllSubmissions(id).then(({ data }) => setItems(data)),
    ])
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaved = (updated: TaskSubmissionAdmin) => {
    setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const submittedCount = items.filter((i) => i.submissionUrl).length;

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/tasks')}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Проверка домашних заданий</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{task?.title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#FFF3EA] text-[#E07628]">
          {submittedCount} из {items.length} сдали работу
        </span>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">Пока ничего нет</p>
          <p className="text-xs text-gray-400">
            Здесь появятся дети, за которых родитель или тренер загрузили выполненное задание или уже поставили оценку
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <SubmissionRow key={item._id} taskId={id!} item={item} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
