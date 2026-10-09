import type { DocumentAiResult } from '../../types';

/** Отображение ИИ-расшифровки медицинского документа */
export default function DocumentAiPanel({ result, at }: { result: DocumentAiResult; at?: string }) {
  const Block = ({ title, items }: { title: string; items: string[] }) =>
    items.length ? (
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 leading-relaxed">
          {items.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
    ) : null;

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-snug">
        Расшифровка подготовлена ИИ{at ? ` ${new Date(at).toLocaleDateString('ru-RU')}` : ''}. Она объясняет написанное в документе
        простыми словами, носит информационный характер и не заменяет консультацию врача.
      </p>
      <div>
        <p className="text-xs font-semibold text-[#E07628]">{result.docType}</p>
        <p className="text-sm text-gray-800 leading-relaxed mt-1">{result.summary}</p>
      </div>
      <Block title="Главное в документе" items={result.keyFindings} />
      {result.terms.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Термины и сокращения</p>
          <dl className="space-y-1.5">
            {result.terms.map((t, i) => (
              <div key={i} className="text-sm leading-relaxed">
                <dt className="inline font-semibold text-gray-800">{t.term}</dt>
                <dd className="inline text-gray-600"> — {t.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <Block title="Что рекомендовано в документе" items={result.recommendations} />
      <Block title="Вопросы, которые стоит задать врачу" items={result.questionsForDoctor} />
      <Block title="Что важно знать тренеру" items={result.forTrainer} />
    </div>
  );
}
