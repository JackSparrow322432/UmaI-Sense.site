import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { consentsApi, screeningApi } from '../../api';
import type { ConsentType, Screening, ScreeningSection, ScreeningStatus } from '../../types';
import ModalShell from '../../components/modals/ModalShell';
import ConsentCheckbox from '../../components/legal/ConsentCheckbox';

/**
 * ИИ-скрининг ребёнка: анализ профиля, наблюдений, вех развития и документов.
 * Перед первым запуском — отдельное согласие родителя (и согласие на трансграничную передачу,
 * если используется внешний ИИ). Отчёт — информационный, не медицинское заключение.
 */

const LEVEL: Record<'low' | 'medium' | 'high', { label: string; cls: string }> = {
  low: { label: 'низкий', cls: 'bg-emerald-50 text-emerald-700' },
  medium: { label: 'средний', cls: 'bg-amber-50 text-amber-700' },
  high: { label: 'высокий', cls: 'bg-red-50 text-red-600' },
};

/** Куда вести из блока «Каких данных не хватает» */
const sectionLink = (childId: string, s: ScreeningSection): { to: string; label: string } => {
  const profile = (tab: string, label: string) => ({ to: `/children/${childId}/profile?tab=${tab}`, label });
  switch (s) {
    case 'sensory': return profile('sensory', 'Сенсорика');
    case 'fears': return profile('fears', 'Страхи и триггеры');
    case 'interests': return profile('interests', 'Интересы');
    case 'goals': return profile('goals', 'Цели');
    case 'behavioral': return profile('behavioral', 'Поведение');
    case 'documents': return { to: `/children/${childId}/documents`, label: 'Документы' };
    case 'observations': return { to: `/children/${childId}/diary`, label: 'Дневник наблюдений' };
    case 'milestones': return { to: `/children/${childId}/milestones`, label: 'Развитие' };
    case 'skating': return profile('basic', 'Адаптивное катание');
    default: return profile('basic', 'Основное');
  }
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const DOCS_MODE: Record<ScreeningStatus['documentsMode'], string> = {
  none: 'Документы не используются.',
  types_only: 'Из документов передаются только их типы («выписка», «заключение невролога»…) — без текста и названий файлов.',
  text: 'ИИ анализирует текст документов PDF и Word; имена, ИИН, телефоны и даты в тексте скрываются автоматически. Фото и сканы документов во внешний ИИ не передаются — загружайте документы в PDF.',
};

function Card({ title, icon, children, tone = 'default' }: { title: string; icon: string; children: React.ReactNode; tone?: 'default' | 'green' | 'red' }) {
  const toneCls = tone === 'green' ? 'border-emerald-100' : tone === 'red' ? 'border-red-100' : 'border-gray-200';
  return (
    <section className={`bg-white rounded-xl border ${toneCls} p-4`}>
      <h2 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2"><span aria-hidden="true">{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

const List = ({ items }: { items: string[] }) =>
  items.length ? (
    <ul className="space-y-1.5 text-sm text-gray-700 leading-relaxed list-disc pl-5">
      {items.map((x, i) => <li key={i}>{x}</li>)}
    </ul>
  ) : <p className="text-xs text-gray-400">Нет данных</p>;

export default function ScreeningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ScreeningStatus | null>(null);
  const [history, setHistory] = useState<Screening[]>([]);
  const [current, setCurrent] = useState<Screening | null>(null);
  const [running, setRunning] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [agreeScreening, setAgreeScreening] = useState(false);
  const [agreeCrossBorder, setAgreeCrossBorder] = useState(false);
  const [agreeDocs, setAgreeDocs] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, h] = await Promise.all([screeningApi.status(id), screeningApi.list(id)]);
      setStatus(s.data);
      setHistory(h.data);
      const lastDone = h.data.find((x) => x.status === 'done');
      if (lastDone) {
        const { data } = await screeningApi.get(id, lastDone._id);
        setCurrent(data);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось загрузить данные скрининга');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const run = async (consentJustGiven = false) => {
    if (!id || !status) return;
    if (!consentJustGiven && status.missingConsents.length) { setConsentOpen(true); return; }
    setRunning(true);
    try {
      const { data } = await screeningApi.run(id);
      setCurrent(data);
      setHistory((prev) => [data, ...prev]);
      toast.success('Скрининг готов');
    } catch (err: any) {
      const d = err?.response?.data;
      if (d?.code === 'CONSENT_REQUIRED') {
        setStatus((s) => (s ? { ...s, missingConsents: d.missingConsents } : s));
        setConsentOpen(true);
      } else {
        toast.error(d?.message || 'Не удалось выполнить скрининг');
      }
    } finally {
      setRunning(false);
    }
  };

  const needAi = status?.missingConsents.includes('ai_screening') ?? false;
  const needCross = status?.missingConsents.includes('cross_border') ?? false;
  const needDocs = status?.missingConsents.includes('documents_ai') ?? false;

  const giveConsent = async () => {
    const types: ConsentType[] = [];
    if (needAi) types.push('ai_screening');
    if (needCross) types.push('cross_border');
    if (needDocs) types.push('documents_ai');
    setSavingConsent(true);
    try {
      await consentsApi.grant(types);
      setStatus((s) => (s ? { ...s, missingConsents: [] } : s));
      setConsentOpen(false);
      toast.success('Согласие сохранено');
      void run(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось сохранить согласие');
    } finally {
      setSavingConsent(false);
    }
  };

  const openReport = async (s: Screening) => {
    if (!id || s.status !== 'done') return;
    try {
      const { data } = await screeningApi.get(id, s._id);
      setCurrent(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error('Не удалось открыть отчёт');
    }
  };

  const r = current?.result;

  return (
    <div className="space-y-5 pb-16">
      <button onClick={() => navigate(`/children/${id}`)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition">
        ← Назад
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">🧭 ИИ-скрининг</h1>
        <p className="text-xs text-gray-400 mt-1">
          ИИ анализирует профиль ребёнка, наблюдения за последние {current?.inputSummary.periodDays ?? 30} дней, вехи
          развития и документы и готовит отчёт для вас и тренера.
        </p>
      </div>

      {/* Постоянная плашка — результат не является медицинским заключением */}
      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
        <b>Результат ИИ-скрининга носит информационный характер и не является медицинским заключением.</b>{' '}
        Он не ставит диагнозов и не заменяет консультацию врача или специалиста.
      </div>

      {/* Запуск */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {status && !status.enabled ? (
          <p className="text-sm text-gray-500">ИИ-скрининг сейчас недоступен: он не настроен на сервере. Обратитесь к администратору.</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => run()}
              disabled={running || !status}
              className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {running && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {running ? 'Анализируем данные… это может занять до минуты' : current ? 'Запустить новый скрининг' : 'Запустить ИИ-скрининг'}
            </button>
            {status && (
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {status.provider === 'openai'
                  ? 'Во внешний сервис ИИ передаются только обезличенные данные — без имени, фамилии, ИИН, даты рождения и фото. '
                  : 'Используется ИИ-модель, размещённая в Казахстане. '}
                {DOCS_MODE[status.documentsMode]} Не больше {status.dailyLimit} запусков в сутки.{' '}
                <Link to="/privacy#ai" target="_blank" className="underline">Подробнее</Link>
              </p>
            )}
          </>
        )}
      </div>

      {/* Отчёт */}
      {r && current && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Отчёт от {fmtDate(current.createdAt)} · использовано: {current.inputSummary.sections.join(', ')}
            {current.inputSummary.documentsSkipped ? ` · не удалось прочитать документов: ${current.inputSummary.documentsSkipped}` : ''}
          </p>

          <Card title="Общая картина" icon="📝"><p className="text-sm text-gray-700 leading-relaxed">{r.summary}</p></Card>
          <Card title="Сильные стороны" icon="💪" tone="green"><List items={r.strengths} /></Card>

          <Card title="Зоны внимания" icon="🔍">
            {r.attentionAreas.length ? (
              <ul className="space-y-2.5">
                {r.attentionAreas.map((a, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{a.area}</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${LEVEL[a.level].cls}`}>внимание: {LEVEL[a.level].label}</span>
                    </div>
                    <p className="text-gray-600 leading-relaxed mt-0.5">{a.observation}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-gray-400">Нет данных</p>}
          </Card>

          <Card title="Риски" icon="⚠️" tone="red"><List items={r.risks} /></Card>
          <Card title="Рекомендации родителю" icon="🏠"><List items={r.recommendationsParent} /></Card>
          <Card title="Рекомендации тренеру" icon="⛸️"><List items={r.recommendationsTrainer} /></Card>

          <Card title="К каким специалистам обратиться" icon="👩‍⚕️">
            {r.specialists.length ? (
              <ul className="space-y-1.5 text-sm">
                {r.specialists.map((s, i) => (
                  <li key={i}><span className="font-medium text-gray-800">{s.specialist}</span><span className="text-gray-600"> — {s.reason}</span></li>
                ))}
              </ul>
            ) : <p className="text-xs text-gray-400">Нет рекомендаций</p>}
          </Card>

          {r.missingData.length > 0 && (
            <section className="rounded-xl border border-dashed border-[#E07628]/40 bg-[#FFF8F2] p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">🧩 Каких данных не хватает</h2>
              <p className="text-xs text-gray-500 mb-3">Заполните эти разделы — следующий скрининг будет точнее.</p>
              <ul className="space-y-2">
                {r.missingData.map((m, i) => {
                  const link = sectionLink(id!, m.section);
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-gray-700 leading-relaxed">{m.why}</span>
                      <Link to={link.to} className="shrink-0 text-xs font-semibold text-[#E07628] hover:underline">{link.label} →</Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* История */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">История скринингов</p>
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {history.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => openReport(s)}
                  disabled={s.status !== 'done'}
                  className={`w-full text-left px-4 py-3 transition ${s.status === 'done' ? 'hover:bg-gray-50' : 'cursor-default'} ${current?._id === s._id ? 'bg-[#FFF8F2]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">{fmtDate(s.createdAt)}</span>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${s.status === 'done' ? 'bg-emerald-50 text-emerald-700' : s.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                      {s.status === 'done' ? 'готов' : s.status === 'failed' ? 'ошибка' : 'в процессе'}
                    </span>
                  </div>
                  {s.result?.summary && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{s.result.summary}</p>}
                  {s.status === 'failed' && s.error && <p className="text-xs text-red-500 mt-1">{s.error}</p>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Согласие перед первым запуском */}
      {consentOpen && (
        <ModalShell title="Согласие на ИИ-скрининг" onClose={() => setConsentOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              Перед первым запуском нужно ваше согласие как законного представителя. Его можно отозвать в разделе
              «Настройки → Мои согласия».
            </p>
            {needAi && (
              <ConsentCheckbox checked={agreeScreening} onChange={setAgreeScreening} required link={{ to: '/agreement#consent-ai-screening', label: '(текст согласия)' }}>
                Я даю согласие на автоматизированный анализ профиля ребёнка, наблюдений и документов для подготовки
                отчёта ИИ-скрининга. Я понимаю, что отчёт не является медицинским заключением
              </ConsentCheckbox>
            )}
            {needCross && (
              <ConsentCheckbox checked={agreeCrossBorder} onChange={setAgreeCrossBorder} required link={{ to: '/privacy#cross-border', label: '(подробнее)' }}>
                Я согласен(на) на трансграничную передачу обезличенных сведений о развитии ребёнка (без имени, ИИН,
                даты рождения, фото и документов) внешнему сервису ИИ
              </ConsentCheckbox>
            )}
            {needDocs && (
              <ConsentCheckbox checked={agreeDocs} onChange={setAgreeDocs} required link={{ to: '/agreement#consent-documents-ai', label: '(текст согласия)' }}>
                Я даю согласие на передачу внешнему сервису ИИ обезличенного текста загруженных документов
                (PDF, Word) — имена, ИИН, телефоны и даты в тексте скрываются. Фото документов не передаются
              </ConsentCheckbox>
            )}
            <button
              type="button"
              onClick={giveConsent}
              disabled={savingConsent || (needAi && !agreeScreening) || (needCross && !agreeCrossBorder) || (needDocs && !agreeDocs)}
              className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50"
            >
              {savingConsent ? 'Сохранение…' : 'Дать согласие'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
