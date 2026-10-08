import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LEGAL_VERSION } from './legalInfo';

interface Props {
  title: string;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
  other: { to: string; label: string };
}

/** Общая обёртка для /privacy и /agreement: заголовок, редакция, оглавление с якорями */
export default function LegalLayout({ title, toc, children, other }: Props) {
  const { hash } = useLocation();
  // Ссылки вида /privacy#third-parties из чекбоксов согласия: страница рисуется после загрузки JS,
  // поэтому браузер сам до якоря не прокручивает
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 text-sm text-gray-700 leading-relaxed space-y-4 [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:pt-3 [&_h2]:text-base [&_h2]:scroll-mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          <Link to="/" className="text-gray-400 hover:text-[#E07628]">← На главную</Link>
          <Link to={other.to} className="text-[#E07628] hover:underline">{other.label} →</Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400">Редакция от {LEGAL_VERSION}</p>

        <nav aria-label="Содержание" className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Содержание</p>
          <ol className="list-decimal pl-5 space-y-0.5 text-[13px]">
            {toc.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className="text-gray-600 hover:text-[#E07628]">{t.label}</a></li>
            ))}
          </ol>
        </nav>

        {children}
      </article>
    </div>
  );
}
