import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../api';
import { saveBlobResponse } from '../../utils/downloadBlob';
import type { AdminSummary, AdminSummaryStatus } from '../../types';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
const authorName = (s: AdminSummary) =>
  typeof s.createdBy === 'object' && s.createdBy ? (s.createdBy.name || s.createdBy.email || 'администратор') : 'администратор';

function Section({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-800 mb-1.5">{title}</h4>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="text-[#E07628] flex-shrink-0">•</span><span>{t}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-gray-400">{empty}</p>}
    </div>
  );
}

function SummaryView({ s }: { s: AdminSummary }) {
  const r = s.result!;
  const inp = s.inputSummary;
  const docLabel = (ref?: string) => {
    const d = ref ? inp.documents.find((x) => x.ref === ref) : undefined;
    return d ? ` (${d.ref}: ${d.kind}, ${fmtDate(d.uploadedAt)})` : '';
  };
  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
        Учтено документов: <b>{inp.documentsUsed} из {inp.documentsTotal}</b> · использовано: {inp.sections.join(', ')}
        {inp.notes.length > 0 && <p className="text-amber-700 mt-1">Не учтено: {inp.notes.join('; ')}.</p>}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-1.5">Кратко о ребёнке</h4>
        <p className="text-sm text-gray-700 leading-relaxed">{r.overview}</p>
      </div>
      <Section title="Медицинские сведения из документов"
        items={r.medical.map((m) => `${m.text}${docLabel(m.source)}`)}
        empty={inp.documentsUsed ? 'В документах нет медицинских сведений' : 'Документы не учтены'} />
      <Section title="Ограничения и противопоказания для занятий" items={r.restrictions} />
      <Section title="Что важно для безопасных занятий" items={r.safety} empty="Нет данных" />
      <Section title="Сильные стороны и интересы" items={r.strengths} empty="Нет данных" />
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-1.5">Динамика за {inp.periodDays} дней</h4>
        <p className="text-sm text-gray-700 leading-relaxed">{r.dynamics || 'Нет данных'}</p>
      </div>
      <Section title="Рекомендации администратору" items={r.adminRecommendations} empty="Нет" />
      <Section title="Чего не хватает" items={r.gaps} empty="Существенных пробелов не найдено" />
      <Section title="Противоречия в данных" items={r.contradictions} />
      {inp.documents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-1.5">Документы</h4>
          <ul className="text-xs divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {inp.documents.map((d) => (
              <li key={d.ref} className="px-3 py-2 flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="font-semibold text-gray-700">{d.ref}</span>
                <span className="text-gray-700 break-all">{d.fileName}</span>
                <span className="text-gray-400">· {d.kind} · {fmtDate(d.uploadedAt)}</span>
                <span className={d.used ? 'text-emerald-600' : 'text-amber-700'}>
                  · {d.used ? 'учтён' : `не учтён — ${d.reason ?? ''}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-gray-400">Сформировано ИИ, носит информационный характер, не является медицинским заключением.</p>
    </div>
  );
}

/** ИИ-сводка по ребёнку для администратора: профиль + документы + наблюдения, история и PDF */
export default function AdminAiSummary({ childId, childName }: { childId: string; childName: string }) {
  const [status, setStatus] = useState<AdminSummaryStatus | null>(null);
  const [history, setHistory] = useState<AdminSummary[]>([]);
  const [current, setCurrent] = useState<AdminSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);

  const loadHistory = () =>
    adminApi.getSummaries(childId).then(({ data }) => {
      setHistory(data);
      const last = data.find((x) => x.status === 'done');
      if (last && !current) adminApi.getSummary(childId, last._id).then(({ data: full }) => setCurrent(full)).catch(() => {});
    }).catch(() => {});

  useEffect(() => {
    adminApi.getSummaryStatus(childId).then(({ data }) => setStatus(data)).catch(() => {});
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const run = async () => {
    setRunning(true);
    try {
      const { data } = await adminApi.createSummary(childId);
      setCurrent(data);
      toast.success('ИИ-сводка готова');
      loadHistory();
      adminApi.getSummaryStatus(childId).then(({ data: st }) => setStatus(st)).catch(() => {});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось сформировать сводку');
    } finally {
      setRunning(false);
    }
  };

  const open = async (id: string) => {
    try { setCurrent((await adminApi.getSummary(childId, id)).data); } catch { toast.error('Не удалось открыть сводку'); }
  };

  const download = async (id: string) => {
    setPdfId(id);
    try {
      saveBlobResponse(await adminApi.getSummaryPdf(childId, id), `UmaiSense_ИИ-сводка_${childName}.pdf`);
    } catch {
      toast.error('Не удалось скачать PDF');
    } finally {
      setPdfId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">🧠 ИИ-сводка по ребёнку</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Профиль, все документы (PDF, Word, фото), наблюдения за 30 дней и вехи развития — кратко для администратора.
          </p>
          {status && (
            <p className="text-xs text-gray-400 mt-1">
              Документов: {status.documentsTotal}, расшифровано: {status.documentsReady}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {current?.status === 'done' && (
            <button type="button" onClick={() => download(current._id)} disabled={pdfId === current._id}
              className="rounded-xl border border-[#E07628] text-[#E07628] hover:bg-[#FFF3EA] px-3 py-2 text-sm font-semibold transition disabled:opacity-60">
              {pdfId === current._id ? 'Готовим PDF…' : 'Скачать ИИ-сводку (PDF)'}
            </button>
          )}
          <button type="button" onClick={run} disabled={running || !status?.canRun}
            className="flex items-center gap-2 bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50">
            {running && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {running ? 'Формируем… (до минуты)' : current ? 'Сформировать заново' : 'Сформировать ИИ-сводку'}
          </button>
        </div>
      </div>

      {status && !status.enabled && (
        <div className="text-sm text-gray-500">
          ИИ сейчас недоступен: он не настроен на сервере.
          {status.configProblem && <p className="text-xs text-gray-400 mt-1">Для администратора: {status.configProblem}</p>}
        </div>
      )}
      {status?.enabled && status.missingConsents.includes('cross_border') && (
        <p className="text-sm text-amber-700">
          Родитель не дал согласие на передачу обезличенных данных во внешний сервис ИИ — сводку сформировать нельзя.
        </p>
      )}
      {status?.enabled && status.canRun && status.missingConsents.includes('documents_ai') && (
        <p className="text-xs text-amber-700">
          Родитель не дал согласие на анализ документов ИИ — сводка будет сформирована без содержимого документов.
        </p>
      )}

      {current?.status === 'done' && current.result && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-3">Сводка от {fmt(current.createdAt)} · {authorName(current)}</p>
          <SummaryView s={current} />
        </div>
      )}

      {history.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">История сводок</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {history.map((h) => (
              <li key={h._id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-gray-700">
                  {fmt(h.createdAt)} <span className="text-gray-400">· {authorName(h)}</span>
                  {h.status === 'done'
                    ? <span className="text-gray-400"> · документов {h.inputSummary?.documentsUsed ?? 0} из {h.inputSummary?.documentsTotal ?? 0}</span>
                    : <span className="text-red-500"> · {h.status === 'failed' ? `ошибка${h.error ? `: ${h.error}` : ''}` : 'формируется'}</span>}
                </span>
                {h.status === 'done' && (
                  <span className="flex gap-3 text-xs font-semibold">
                    <button type="button" className="text-[#E07628] hover:underline" onClick={() => open(h._id)}>Открыть</button>
                    <button type="button" className="text-[#E07628] hover:underline" onClick={() => download(h._id)} disabled={pdfId === h._id}>
                      {pdfId === h._id ? 'PDF…' : 'PDF'}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
