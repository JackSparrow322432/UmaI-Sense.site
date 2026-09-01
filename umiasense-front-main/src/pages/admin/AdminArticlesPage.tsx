import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { articlesApi } from '../../api';
import type { Article } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminArticlesPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    articlesApi.getAll()
      .then(({ data }) => setArticles(data))
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить статью «${title}»?`)) return;
    setDeleting(id);
    try {
      await articlesApi.delete(id);
      setArticles((prev) => prev.filter((a) => a._id !== id));
      toast.success('Статья удалена');
    } catch { toast.error('Ошибка удаления'); }
    finally { setDeleting(null); }
  };

  const handleTogglePublish = async (article: Article) => {
    setToggling(article._id);
    try {
      const { data } = await articlesApi.update(article._id, { published: !article.published });
      setArticles((prev) => prev.map((a) => a._id === article._id ? { ...a, ...data } : a));
      toast.success(data.published ? 'Статья опубликована' : 'Статья снята с публикации');
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

  const published = articles.filter((a) => a.published).length;
  const drafts    = articles.length - published;

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Статьи</h1>
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
          to="/admin/articles/new"
          className="flex-shrink-0 inline-flex items-center gap-2 bg-[#E07628] hover:bg-[#C4641A] active:scale-[0.97] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Новая статья
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[3fr_1fr_1.1fr_auto] px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <span className="text-xs font-medium text-gray-500">Статья</span>
          <span className="text-xs font-medium text-gray-500">Статус</span>
          <span className="text-xs font-medium text-gray-500">Дата</span>
          <span className="text-xs font-medium text-gray-500">Действия</span>
        </div>

        {articles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFF3EA] mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Статей пока нет</p>
            <p className="text-xs text-gray-400 mb-5">Создайте первую статью для родителей</p>
            <Link
              to="/admin/articles/new"
              className="inline-flex items-center gap-1.5 bg-[#E07628] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#C4641A] transition-all"
            >
              Создать статью
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {articles.map((article) => (
              <div
                key={article._id}
                className="flex flex-col sm:grid sm:grid-cols-[3fr_1fr_1.1fr_auto] items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-all"
              >
                {/* Article info */}
                <div className="flex items-center gap-3 min-w-0 w-full">
                  {article.coverImage ? (
                    <img src={article.coverImage} className="w-14 h-11 rounded-xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-14 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1 leading-snug">{article.title}</p>
                    {article.excerpt && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{article.excerpt}</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="hidden sm:block">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                    article.published ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {article.published ? 'Опубликовано' : 'Черновик'}
                  </span>
                </div>

                {/* Date */}
                <div className="hidden sm:block">
                  <span className="text-xs text-gray-400">
                    {article.published && article.publishedAt
                      ? formatDate(article.publishedAt)
                      : formatDate(article.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleTogglePublish(article)}
                    disabled={toggling === article._id}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 whitespace-nowrap ${
                      article.published
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {toggling === article._id ? '...' : article.published ? 'Скрыть' : 'Опубликовать'}
                  </button>
                  <button
                    onClick={() => navigate(`/admin/articles/${article._id}/edit`)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF3EA] text-[#E07628] hover:bg-[#FFE8D0] transition-all whitespace-nowrap"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(article._id, article.title)}
                    disabled={deleting === article._id}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all disabled:opacity-50 flex-shrink-0"
                    title="Удалить"
                  >
                    {deleting === article._id ? (
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

        {/* Table footer */}
        {articles.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">Всего {articles.length} статей</p>
          </div>
        )}
      </div>
    </div>
  );
}
