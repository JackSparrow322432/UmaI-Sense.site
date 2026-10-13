import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import Child from '../models/Child';
import User from '../models/User';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import DocumentModel from '../models/Document';
import Screening from '../models/Screening';
import { ChildMilestone } from '../models/Milestone';
import AdminSummary, { IAdminSummary, IAdminSummaryDoc, IAdminSummaryResult } from '../models/AdminSummary';
import { makeScrubber, childProfileLines, daysAgoLabel, getAge, MOOD_RU, CAT_RU, TAG_RU, Scrub } from './anonymize';
import { hasActiveConsent } from './consent';
import { providerName, getClient, isProviderInKz, aiConfigProblem, aiErrorMessage, parseJson, strArr } from './aiClient';
import { ensureDocumentInsights, documentAiAvailability } from './documentAi';

/**
 * ИИ-сводка по ребёнку для администратора: профиль + все документы + наблюдения → краткая справка
 * и PDF. Доступ — только администратор (routes/admin.routes.ts).
 *
 * Персональные данные: в ИИ уходит только обезличенный текст (имена, ИИН, телефоны, email, даты
 * скрываются makeScrubber); документы — их расшифровки (PDF/Word — текст, фото — текст после
 * локального OCR); изображения не отправляются. Ответ ИИ повторно обезличивается. Имя ребёнка
 * подставляется только в PDF на нашей стороне.
 *
 * Согласия даёт родитель: cross_border — для внешнего ИИ (без него сводку сформировать нельзя),
 * documents_ai — для содержимого документов (без него сводка формируется без документов,
 * и это явно указывается).
 */

export class AdminSummaryError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const PERIOD_DAYS = 30;
export const SUMMARY_DAILY_LIMIT = () => Math.max(Number(process.env.AI_ADMIN_SUMMARY_DAILY_LIMIT) || 10, 1);
const DOCS_MAX = () => Math.min(Math.max(Number(process.env.AI_ADMIN_SUMMARY_DOCS_MAX) || 10, 1), 30);
/** Сколько времени можно потратить на дорасшифровку документов (общий лимит ответа ~60 с) */
const DOCS_TIME_BUDGET_MS = 30_000;

const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Almaty' }) : '—';
const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });

const fileKind = (mime: string) =>
  mime === 'application/pdf' ? 'PDF' : mime.includes('word') ? 'Word' : mime.startsWith('image/') ? 'фото' : 'файл';

// ─── Доступность ──────────────────────────────────────────────────────────────

export const summaryStatus = async (childId: string) => {
  const child = await Child.findById(childId).select('parentId').lean();
  if (!child) throw new AdminSummaryError('Ребёнок не найден', 404);
  const p = providerName();
  const ai = p === 'off' ? null : getClient(p);
  const [crossBorder, docsConsent, documentsTotal, documentsReady] = await Promise.all([
    hasActiveConsent(child.parentId, 'cross_border'),
    hasActiveConsent(child.parentId, 'documents_ai'),
    DocumentModel.countDocuments({ childId, status: 'ready' }),
    DocumentModel.countDocuments({ childId, status: 'ready', aiStatus: 'done' }),
  ]);
  const missingConsents = [
    ...(ai && !isProviderInKz(p) && !crossBorder ? ['cross_border'] : []),
    ...(docsConsent ? [] : ['documents_ai']),
  ];
  return {
    provider: p,
    enabled: !!ai,
    ...(ai ? {} : { configProblem: aiConfigProblem() ?? 'ИИ не настроен' }),
    // Без cross_border внешний ИИ использовать нельзя; без documents_ai — можно, но без документов
    canRun: !!ai && (isProviderInKz(p) || crossBorder),
    missingConsents,
    documentsTotal,
    documentsReady,
    dailyLimit: SUMMARY_DAILY_LIMIT(),
  };
};

// ─── Промпт ──────────────────────────────────────────────────────────────────

const SYSTEM = `Ты — опытный специалист по сопровождению детей с особыми потребностями и консультант администратора
центра адаптивного катания. Составь КРАТКУЮ сводку по ребёнку для администратора: кто этот ребёнок, что важно из
медицинских документов, как безопасно организовать занятия, какой тренер/формат подойдёт, каких данных не хватает.
Правила:
- опирайся ТОЛЬКО на приведённые данные; не придумывай;
- НЕ ставь новых диагнозов и не назначай лечение; диагнозы и заключения приводи только так, как они написаны
  в документах, и указывай источник — метку документа ([Д1], [Д2]…);
- если данные противоречат друг другу (например, анкета и документ), прямо напиши об этом;
- не указывай ФИО, ИИН, адреса, телефоны и даты рождения;
- пиши по-русски, спокойно и профессионально, коротко: сводка должна читаться за 1–2 минуты.
Ответь ТОЛЬКО JSON-объектом:
{
  "overview": "3–5 предложений: кто ребёнок, главное о развитии и поведении",
  "medical": [{"text": "диагноз/заключение/показатель так, как в документе", "source": "Д1"}],
  "restrictions": ["ограничения и противопоказания для физических занятий из документов"],
  "safety": ["что важно для безопасных занятий: триггеры, сенсорика, что помогает успокоиться"],
  "strengths": ["сильные стороны и интересы"],
  "dynamics": "1–3 предложения о динамике за 30 дней по наблюдениям (или что наблюдений мало)",
  "adminRecommendations": ["какой тренер/формат занятий подойдёт, на что обратить внимание при записи"],
  "gaps": ["каких документов или разделов анкеты не хватает / что устарело"],
  "contradictions": ["противоречия в данных, если есть"]
}`;

const buildUserPrompt = (a: {
  child: any; scrub: Scrub; emotions: any[]; activities: any[]; diary: any[]; milestones: any[];
  docs: { ref: string; kind: string; uploadedAt: Date; r: any }[]; screening: any; notes: string[];
}): string => {
  const { child, scrub } = a;
  const L: string[] = [];
  L.push('=== ПРОФИЛЬ РЕБЁНКА (обезличен) ===');
  L.push(...childProfileLines(child, scrub));
  if (child.goals?.length) L.push(`Цели: ${child.goals.map((g: any) => scrub(`${g.title}${g.description ? ` (${g.description})` : ''}`)).join('; ')}`);
  const ski = child.skiExperience;
  if (ski && typeof ski.hasExperience === 'boolean') L.push(`Опыт катания на лыжах: ${ski.hasExperience ? `да${ski.when ? `, ${scrub(ski.when)}` : ''}` : 'нет'}`);
  const sk = child.adaptiveSkating;
  if (sk && typeof sk.hasExperience === 'boolean') {
    L.push(`Опыт адаптивного катания: ${sk.hasExperience ? `да${sk.when ? `, ${scrub(sk.when)}` : ''}${sk.details ? ` — ${scrub(sk.details)}` : ''}` : 'нет'}`);
  }

  L.push('');
  L.push(`=== НАБЛЮДЕНИЯ ЗА ${PERIOD_DAYS} ДНЕЙ ===`);
  if (!a.emotions.length && !a.activities.length && !a.diary.length) L.push('Наблюдений за период нет.');
  a.emotions.slice(0, 20).forEach((e) => L.push(`- эмоция: ${MOOD_RU[e.mood] ?? e.mood} (${e.intensity}/5)${e.comment ? ` — «${scrub(e.comment)}»` : ''} · ${daysAgoLabel(e.createdAt)}`));
  a.activities.slice(0, 20).forEach((x) => L.push(`- активность: ${scrub(x.name)} (${CAT_RU[x.category] ?? x.category}${x.duration ? `, ${x.duration} мин` : ''})${x.notes ? ` — «${scrub(x.notes)}»` : ''} · ${daysAgoLabel(x.date)}`));
  a.diary.slice(0, 15).forEach((d) => L.push(`- дневник [${TAG_RU[d.tag] ?? d.tag}${d.author?.role === 'trainer' ? ', тренер' : ', родитель'}]: «${scrub(d.text)}» · ${daysAgoLabel(d.createdAt)}`));

  if (a.milestones.length) {
    const ST: Record<string, string> = { achieved: 'освоено', in_progress: 'в процессе', not_yet: 'пока нет' };
    L.push('');
    L.push('=== ВЕХИ РАЗВИТИЯ ===');
    a.milestones.slice(0, 40).forEach((m) => L.push(`- ${m.milestoneId?.direction ?? ''}: ${m.milestoneId?.skill ?? ''} — ${ST[m.status] ?? m.status}`));
  }

  L.push('');
  L.push('=== МЕДИЦИНСКИЕ ДОКУМЕНТЫ (расшифровки, обезличены) ===');
  if (!a.docs.length) L.push('Содержимое документов недоступно для сводки.');
  for (const d of a.docs) {
    const r = d.r;
    L.push(`[${d.ref}] ${scrub(r.docType || d.kind)}, загружен ${fmtDate(d.uploadedAt)}: ${scrub(r.summary)}`);
    if (r.keyFindings?.length) L.push(`  Главное: ${r.keyFindings.slice(0, 8).map(scrub).join('; ')}`);
    if (r.recommendations?.length) L.push(`  Рекомендовано: ${r.recommendations.slice(0, 6).map(scrub).join('; ')}`);
    if (r.forTrainer?.length) L.push(`  Для тренера: ${r.forTrainer.slice(0, 6).map(scrub).join('; ')}`);
  }
  if (a.notes.length) L.push(`Примечание: ${a.notes.join('; ')}.`);

  if (a.screening?.result) {
    const r = a.screening.result;
    L.push('');
    L.push('=== ПОСЛЕДНИЙ ИИ-СКРИНИНГ (сформирован по запросу родителя) ===');
    L.push(scrub(r.summary));
    if (r.risks?.length) L.push(`Риски: ${r.risks.map(scrub).join('; ')}`);
    if (r.recommendationsTrainer?.length) L.push(`Тренеру: ${r.recommendationsTrainer.map(scrub).join('; ')}`);
  }
  return L.join('\n');
};

const toResult = (obj: any, scrub: Scrub, refs: Set<string>): IAdminSummaryResult | null => {
  if (!obj || typeof obj !== 'object' || typeof obj.overview !== 'string') return null;
  const s = (v: unknown, n = 1500) => scrub(String(v ?? '').trim()).slice(0, n);
  const arr = (v: unknown, max = 8) => strArr(v, max).map((x) => scrub(x));
  return {
    overview: s(obj.overview, 2000),
    medical: (Array.isArray(obj.medical) ? obj.medical : [])
      .filter((m: any) => m && (typeof m.text === 'string' || typeof m === 'string'))
      .slice(0, 12)
      .map((m: any) => {
        const text = s(typeof m === 'string' ? m : m.text, 500);
        const src = String(m?.source ?? '').replace(/[[\]\s]/g, '').toUpperCase().replace(/^D/, 'Д');
        return refs.has(src) ? { text, source: src } : { text };
      }),
    restrictions: arr(obj.restrictions),
    safety: arr(obj.safety),
    strengths: arr(obj.strengths),
    dynamics: s(obj.dynamics, 800),
    adminRecommendations: arr(obj.adminRecommendations),
    gaps: arr(obj.gaps),
    contradictions: arr(obj.contradictions, 6),
  };
};

// ─── Формирование ─────────────────────────────────────────────────────────────

export const generateAdminSummary = async (childId: string, adminId: string): Promise<IAdminSummary> => {
  const child: any = await Child.findById(childId).lean();
  if (!child) throw new AdminSummaryError('Ребёнок не найден', 404);

  const p = providerName();
  const ai = p === 'off' ? null : getClient(p);
  if (p === 'off' || !ai) {
    throw new AdminSummaryError('ИИ сейчас недоступен: он не настроен на сервере.', 503, { configProblem: aiConfigProblem() });
  }
  if (!isProviderInKz(p) && !(await hasActiveConsent(child.parentId, 'cross_border'))) {
    throw new AdminSummaryError(
      'Родитель не дал согласие на передачу обезличенных данных во внешний сервис ИИ — сводку сформировать нельзя.',
      403, { code: 'CONSENT_REQUIRED', missingConsents: ['cross_border'] },
    );
  }
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  if (await AdminSummary.countDocuments({ childId: child._id, createdAt: { $gte: dayAgo } }) >= SUMMARY_DAILY_LIMIT()) {
    throw new AdminSummaryError(`Не больше ${SUMMARY_DAILY_LIMIT()} сводок в сутки для одного ребёнка. Попробуйте завтра.`, 429);
  }

  const people = await User.find({ _id: { $in: [child.parentId, ...(child.trainers ?? [])] } }).select('name').lean();
  const scrub = makeScrubber([child.name, child.lastName ?? '', ...people.map((x: any) => x.name)]);

  // Документы: дорасшифровать необработанные (в пределах времени), затем взять готовые расшифровки
  const notes: string[] = [];
  const docsConsent = await hasActiveConsent(child.parentId, 'documents_ai');
  const avail = documentAiAvailability();
  if (!docsConsent) notes.push('родитель не дал согласие на анализ документов ИИ — содержимое документов не учтено');
  else if (!avail.enabled) notes.push(`расшифровка документов недоступна: ${avail.reason}`);
  if (docsConsent && avail.enabled) {
    const cov = await ensureDocumentInsights(child._id, child.parentId, scrub, DOCS_MAX(), Date.now() + DOCS_TIME_BUDGET_MS);
    if (cov.note && !/согласи/.test(cov.note)) notes.push(cov.note);
  }

  const allDocs: any[] = await DocumentModel.find({ childId: child._id, status: 'ready' })
    .sort({ createdAt: 1 }).select('fileName mimeType createdAt aiStatus aiResult aiError').lean();
  const documents: IAdminSummaryDoc[] = [];
  const promptDocs: { ref: string; kind: string; uploadedAt: Date; r: any }[] = [];
  allDocs.forEach((d, i) => {
    const ref = `Д${i + 1}`;
    const decoded = d.aiStatus === 'done' && d.aiResult?.summary;
    const used = !!(docsConsent && avail.enabled && decoded);
    let reason: string | undefined;
    if (!used) {
      reason = !docsConsent ? 'нет согласия родителя на анализ документов ИИ'
        : !avail.enabled ? 'расшифровка документов на сервере выключена'
        : d.mimeType === 'application/msword' ? 'старый формат .doc — нужен PDF или DOCX'
        : d.aiStatus === 'failed' ? (d.aiError || 'не удалось прочитать документ')
        : 'ещё не обработан — сформируйте сводку ещё раз';
    }
    documents.push({
      ref, fileName: String(d.fileName).slice(0, 200), kind: decoded ? String(d.aiResult.docType || fileKind(d.mimeType)).slice(0, 120) : fileKind(d.mimeType),
      uploadedAt: d.createdAt, used, ...(reason ? { reason } : {}),
    });
    if (used) promptDocs.push({ ref, kind: fileKind(d.mimeType), uploadedAt: d.createdAt, r: d.aiResult });
  });

  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 3600 * 1000);
  const [emotions, activities, diary, milestones, screening] = await Promise.all([
    Emotion.find({ childId: child._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).lean(),
    Activity.find({ childId: child._id, date: { $gte: since } }).sort({ date: -1 }).lean(),
    DiaryEntry.find({ childId: child._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).populate('author', 'role').lean(),
    ChildMilestone.find({ childId: child._id }).populate('milestoneId', 'skill direction').lean(),
    Screening.findOne({ childId: child._id, status: 'done' }).sort({ createdAt: -1 }).lean(),
  ]);

  const sections = [
    'профиль',
    ...(emotions.length || activities.length || diary.length ? ['наблюдения за 30 дней'] : []),
    ...(milestones.length ? ['вехи развития'] : []),
    ...(promptDocs.length ? ['документы'] : []),
    ...(screening ? ['ИИ-скрининг родителя'] : []),
  ];
  const summary = await AdminSummary.create({
    childId: child._id, createdBy: new Types.ObjectId(adminId), provider: p, aiModel: ai.model, status: 'pending',
    inputSummary: { sections, periodDays: PERIOD_DAYS, documents, documentsTotal: documents.length, documentsUsed: promptDocs.length, notes },
  });

  try {
    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildUserPrompt({ child, scrub, emotions, activities, diary, milestones, docs: promptDocs, screening, notes }) },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    const result = toResult(parseJson(completion.choices[0]?.message?.content ?? ''), scrub, new Set(documents.map((d) => d.ref)));
    if (!result) throw new AdminSummaryError('ИИ вернул ответ в неверном формате. Попробуйте ещё раз.', 502);
    summary.result = result;
    summary.status = 'done';
    await summary.save();
    return summary;
  } catch (err: any) {
    summary.status = 'failed';
    summary.error = err instanceof AdminSummaryError ? err.message : aiErrorMessage(err, 'Не удалось сформировать сводку. Попробуйте позже.');
    await summary.save().catch(() => {});
    if (err instanceof AdminSummaryError) throw err;
    console.error('[admin-summary] AI error:', err?.status, err?.code ?? err?.message);
    throw new AdminSummaryError(summary.error, err?.status ? 502 : 500);
  }
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

/** Набор функций вёрстки PDF — общий для отдельной сводки и раздела в досье */
export interface PdfKit {
  W: number;
  heading: (t: string) => void;
  para: (t: string, opts?: { color?: string; size?: number }) => void;
  bullets: (items: string[], empty?: string) => void;
  table: (head: string[], rows: string[][], widths: number[]) => void;
}

const GRAY = '#6B7280';
const sourceLabel = (s: IAdminSummary, ref?: string) => {
  const d = ref ? s.inputSummary.documents.find((x) => x.ref === ref) : undefined;
  return d ? ` (${d.ref}: ${d.kind}, ${fmtDate(d.uploadedAt)})` : '';
};

/** Тело сводки: разделы и перечень документов */
export const renderAdminSummaryBody = (k: PdfKit, s: IAdminSummary, number = (t: string) => t): void => {
  const r = s.result!;
  const inp = s.inputSummary;
  k.para(`Учтено документов: ${inp.documentsUsed} из ${inp.documentsTotal}. Использовано: ${inp.sections.join(', ')}.`, { color: GRAY, size: 8.5 });
  if (inp.notes.length) k.para(`Не учтено: ${inp.notes.join('; ')}.`, { color: '#B45309', size: 8.5 });

  k.heading(number('Кратко о ребёнке'));
  k.para(r.overview || '—');
  k.heading(number('Медицинские сведения из документов'));
  k.bullets(r.medical.map((m) => `${m.text}${sourceLabel(s, m.source)}`), inp.documentsUsed ? 'В документах нет медицинских сведений' : 'Документы не учтены');
  if (r.restrictions.length) { k.para('Ограничения и противопоказания для занятий:', { color: GRAY, size: 9 }); k.bullets(r.restrictions); }
  k.heading(number('Что важно для безопасных занятий'));
  k.bullets(r.safety);
  k.heading(number('Сильные стороны и интересы'));
  k.bullets(r.strengths);
  k.heading(number(`Динамика за ${inp.periodDays} дней`));
  k.para(r.dynamics || 'Нет данных');
  k.heading(number('Рекомендации администратору'));
  k.bullets(r.adminRecommendations);
  k.heading(number('Чего не хватает'));
  k.bullets(r.gaps, 'Существенных пробелов не найдено');
  if (r.contradictions.length) { k.para('Противоречия в данных:', { color: GRAY, size: 9 }); k.bullets(r.contradictions); }
  k.heading(number('Документы'));
  k.table(['№', 'Файл', 'Тип', 'Загружен', 'Учтён'],
    inp.documents.map((d) => [d.ref, d.fileName, d.kind, fmtDate(d.uploadedAt), d.used ? 'да' : `нет — ${d.reason ?? ''}`]),
    [30, k.W - 330, 110, 70, 120]);
};

const FONT_DIR = path.join(__dirname, '../../assets/fonts');
const ORANGE = '#E07628';
const DARK = '#1F2937';
const LIGHT = '#F3F4F6';

export const buildAdminSummaryPdf = async (summaryId: string): Promise<{ buffer: Buffer; fileName: string }> => {
  const s = await AdminSummary.findById(summaryId);
  if (!s || s.status !== 'done' || !s.result) throw new AdminSummaryError('Сводка не найдена или не готова', 404);
  const child: any = await Child.findById(s.childId).select('name lastName dateOfBirth').lean();
  if (!child) throw new AdminSummaryError('Ребёнок не найден', 404);
  const author: any = await User.findById(s.createdBy).select('name email').lean();

  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 56, left: 50, right: 50 }, bufferPages: true, info: {
    Title: `ИИ-сводка: ${child.name} ${child.lastName ?? ''}`.trim(), Author: 'UmaiSense', Subject: 'ИИ-сводка по ребёнку',
  } });
  doc.registerFont('regular', fs.readFileSync(path.join(FONT_DIR, 'DejaVuSans.ttf')));
  doc.registerFont('bold', fs.readFileSync(path.join(FONT_DIR, 'DejaVuSans-Bold.ttf')));
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const X = doc.page.margins.left;
  const ensure = (h: number) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
  const k: PdfKit = {
    W,
    heading: (t) => {
      ensure(40);
      doc.moveDown(0.5);
      const y = doc.y;
      doc.rect(X, y, 3, 14).fill(ORANGE);
      doc.font('bold').fontSize(11.5).fillColor(DARK).text(t, X + 10, y, { width: W - 10 });
      doc.moveDown(0.3);
    },
    para: (t, o = {}) => {
      doc.font('regular').fontSize(o.size ?? 9.5).fillColor(o.color ?? DARK);
      ensure(doc.heightOfString(t, { width: W }) + 4);
      doc.text(t, X, doc.y, { width: W });
      doc.moveDown(0.25);
    },
    bullets: (items, empty = 'Нет данных') => {
      if (!items.length) { k.para(empty, { color: GRAY }); return; }
      for (const it of items) {
        doc.font('regular').fontSize(9.5);
        ensure(doc.heightOfString(it, { width: W - 14 }) + 3);
        const y = doc.y;
        doc.fillColor(ORANGE).text('•', X, y);
        doc.fillColor(DARK).text(it, X + 12, y, { width: W - 12 });
        doc.moveDown(0.15);
      }
    },
    table: (head, rows, widths) => {
      const drawRow = (cells: string[], bold = false, bg?: string) => {
        doc.font(bold ? 'bold' : 'regular').fontSize(8.5);
        const h = Math.max(...cells.map((c, i) => doc.heightOfString(c || '—', { width: widths[i] - 8 }))) + 8;
        ensure(h);
        const y = doc.y;
        if (bg) doc.rect(X, y, W, h).fill(bg);
        let x = X;
        cells.forEach((c, i) => { doc.fillColor(bold ? GRAY : DARK).text(c || '—', x + 4, y + 4, { width: widths[i] - 8 }); x += widths[i]; });
        doc.moveTo(X, y + h).lineTo(X + W, y + h).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
        doc.y = y + h;
      };
      drawRow(head, true, LIGHT);
      if (!rows.length) drawRow(head.map((_, i) => (i === 0 ? 'Нет' : '')));
      rows.forEach((row) => drawRow(row));
      doc.moveDown(0.3);
    },
  };

  // Шапка
  const fullName = `${child.name} ${child.lastName ?? ''}`.trim();
  doc.rect(0, 0, doc.page.width, 86).fill(ORANGE);
  doc.font('bold').fontSize(17).fillColor('#FFFFFF').text(`ИИ-сводка: ${fullName}`, X, 24, { width: W });
  doc.font('regular').fontSize(9.5).fillColor('#FFF3EA').text(
    `${child.dateOfBirth ? `Возраст: ${getAge(child.dateOfBirth)} · ` : ''}сформирована ${fmtDateTime(s.createdAt)} · ${author?.name || author?.email || 'администратор'}`,
    X, 50, { width: W },
  );
  doc.y = 100;
  doc.font('regular').fontSize(8).fillColor('#B45309').text(
    'КОНФИДЕНЦИАЛЬНО. Содержит сведения о здоровье ребёнка. Только для служебного использования администратором UmaiSense.',
    X, doc.y, { width: W },
  );
  doc.moveDown(0.4);

  renderAdminSummaryBody(k, s);

  // Колонтитулы: дисклеймер и номер страницы (поле обнуляется, иначе pdfkit создаёт лишние страницы)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 38;
    doc.font('regular').fontSize(7).fillColor(GRAY);
    doc.text('Сформировано ИИ, носит информационный характер, не является медицинским заключением.', X, bottom, { width: W - 70, lineBreak: false });
    doc.text(`Стр. ${i - range.start + 1} из ${range.count}`, X + W - 70, bottom, { width: 70, align: 'right', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
  doc.end();
  const buffer = await done;
  const safe = `${child.lastName ?? ''}_${child.name}`.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'child';
  return { buffer, fileName: `UmaiSense_ИИ-сводка_${safe}_${new Date(s.createdAt).toISOString().slice(0, 10)}.pdf` };
};
