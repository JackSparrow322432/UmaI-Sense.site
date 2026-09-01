import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { articlesApi } from '../../api';
import type { Article } from '../../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/articles/${article._id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 active:scale-[0.98] transition-all"
    >
      {/* Cover */}
      {article.coverImage ? (
        <img src={article.coverImage} className="w-full h-44 object-cover" alt="" />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-[#FFF3EA] to-[#FFF8F2] flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F59B56" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{article.title}</p>
        {article.excerpt && (
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{article.excerpt}</p>
        )}
        <p className="text-[10px] text-gray-300 mt-2.5">
          {article.publishedAt ? formatDate(article.publishedAt) : formatDate(article.createdAt)}
        </p>
      </div>
    </Link>
  );
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    articlesApi.getAll()
      .then(({ data }) => setArticles(data))
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
        <h1 className="text-xl font-bold text-gray-900">Статьи</h1>
        <p className="text-sm text-gray-400 mt-0.5">Советы и материалы для родителей</p>
      </div>

      {articles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFF3EA] mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E07628" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Статей пока нет</p>
          <p className="text-xs text-gray-400">Здесь будут появляться материалы от команды UmaiSense</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {articles.map((a) => <ArticleCard key={a._id} article={a} />)}
        </div>
      )}
    </div>
  );
}
