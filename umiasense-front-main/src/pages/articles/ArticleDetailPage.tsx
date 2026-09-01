import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { articlesApi } from '../../api';
import type { Article } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    articlesApi.getOne(id)
      .then(({ data }) => setArticle(data))
      .catch(() => { toast.error('Статья не найдена'); navigate('/articles'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="pb-20">

      {/* Back */}
      <button
        onClick={() => navigate('/articles')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition mb-5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Все статьи
      </button>

      {/* Cover */}
      {article.coverImage && (
        <div className="w-full h-52 rounded-2xl overflow-hidden mb-5 shadow-sm">
          <img src={article.coverImage} className="w-full h-full object-cover" alt="" />
        </div>
      )}

      {/* Title + meta */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 leading-snug">{article.title}</h1>
        <p className="text-xs text-gray-400 mt-2">
          {article.publishedAt ? formatDate(article.publishedAt) : formatDate(article.createdAt)}
        </p>
        {article.excerpt && (
          <p className="text-sm text-gray-500 mt-3 leading-relaxed border-l-2 border-[#E07628] pl-3">
            {article.excerpt}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm text-gray-700 leading-[1.8] whitespace-pre-wrap">{article.content}</p>
      </div>
    </div>
  );
}
