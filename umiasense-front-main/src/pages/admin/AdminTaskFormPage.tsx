import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tasksApi, uploadApi } from '../../api';

export default function AdminTaskFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [content,     setContent]     = useState('');
  const [coverImage,  setCoverImage]  = useState('');
  const [published,   setPublished]   = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    tasksApi.getOne(id!)
      .then(({ data }) => {
        setTitle(data.title);
        setDescription(data.description ?? '');
        setContent(data.content ?? '');
        setCoverImage(data.coverImage ?? '');
        setPublished(data.published);
      })
      .catch(() => { toast.error('Не удалось загрузить задание'); navigate('/admin/tasks'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadApi.image(file);
      setCoverImage(data.url);
    } catch { toast.error('Ошибка загрузки изображения'); }
    finally { setUploading(false); }
  };

  const handleSave = async (publishNow?: boolean) => {
    if (!title.trim()) { toast.error('Введите заголовок'); return; }
    if (!content.trim()) { toast.error('Введите содержание задания'); return; }
    setSaving(true);
    const willPublish = publishNow ?? published;
    try {
      const payload = { title: title.trim(), description: description.trim(), content: content.trim(), coverImage: coverImage || undefined, published: willPublish };
      if (isEdit) {
        await tasksApi.update(id!, payload);
        toast.success('Задание обновлено');
      } else {
        await tasksApi.create(payload);
        toast.success(willPublish ? 'Задание опубликовано' : 'Черновик сохранён');
      }
      navigate('/admin/tasks');
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputClass = 'w-full border border-gray-200 bg-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#E07628] transition-colors placeholder:text-gray-400 text-gray-900';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/tasks')}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {isEdit ? 'Редактировать задание' : 'Новое задание'}
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Заголовок *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите заголовок задания"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Краткое описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Пару предложений о сути задания (показывается в списке)"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>Обложка</label>
            {coverImage ? (
              <div className="relative group w-full h-48 rounded-xl overflow-hidden border border-gray-200">
                <img src={coverImage} className="w-full h-full object-cover" alt="" />
                <button
                  onClick={() => setCoverImage('')}
                  className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#E07628] hover:bg-gray-50 transition">
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span className="text-xs text-gray-400 mt-2">Нажмите чтобы загрузить изображение</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div>
            <label className={labelClass}>Содержание задания *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Опишите, что нужно сделать в рамках задания..."
              rows={14}
              className={`${inputClass} resize-none leading-relaxed`}
            />
          </div>
        </div>
      </div>

      {isEdit && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Статус публикации</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {published ? 'Задание видно родителям' : 'Черновик — не видно пользователям'}
            </p>
          </div>
          <button
            onClick={() => setPublished((v) => !v)}
            className={`relative w-12 h-6 rounded-full transition-colors ${published ? 'bg-[#E07628]' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${published ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      )}

      <div className="flex gap-3">
        {!isEdit && (
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить черновик'}
          </button>
        )}
        <button
          onClick={() => handleSave(isEdit ? undefined : true)}
          disabled={saving}
          className="flex-1 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60 shadow-sm"
        >
          {saving ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Опубликовать'}
        </button>
      </div>
    </div>
  );
}
