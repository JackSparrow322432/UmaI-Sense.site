import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../types';
import Child from '../models/Child';
import User from '../models/User';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import DocumentModel from '../models/Document';
import { ChildMilestone } from '../models/Milestone';
import Screening, { IScreeningResult } from '../models/Screening';
import { makeScrubber, childProfileLines, daysAgoLabel, MOOD_RU, CAT_RU, TAG_RU, Scrub } from '../utils/anonymize';
import { hasActiveConsent, CONSENT_VERSION } from '../utils/consent';
import { logAccess } from '../utils/audit';
import { extractDocumentText } from '../utils/documentText';
import { Provider, providerName, docsExternalEnabled, getClient, aiErrorMessage } from '../utils/aiClient';
import { documentInsightLines } from '../utils/documentAi';

/**
 * ИИ-скрининг ребёнка: анализ профиля, наблюдений, вех развития и документов → структурированный отчёт
 * (сильные стороны, зоны внимания, риски, рекомендации родителю и тренеру, специалисты, чего не хватает).
 *
 * Провайдер — переменная AI_SCREENING_PROVIDER:
 *  • openai (по умолчанию) — внешний ИИ за пределами РК. Уходит ТОЛЬКО обезличенный профиль
 *    (utils/anonymize.ts). Текст документов НЕ отправляется — только типы документов из
 *    фиксированного словаря («заключение невролога», «выписка»…), без названий файлов.
 *    Требует согласий родителя: ai_screening + cross_border (трансграничная передача).
 *  • local — OpenAI-совместимая модель, развёрнутая в РК (vLLM, Ollama…): AI_LOCAL_BASE_URL,
 *    AI_LOCAL_MODEL. Только в этом режиме в промпт добавляется текст документов (обезличенный).
 *    Требует согласия ai_screening.
 *  • off — скрининг выключен (503).
 *
 * Результат не является медицинским заключением — это указано в промпте и в интерфейсе.
 */

/**
 * Текст документов во ВНЕШНИЙ ИИ — только если оператор явно включил AI_SCREENING_DOCS_EXTERNAL=true
 * (юридическое решение: трансграничная передача сведений о здоровье) И родитель дал отдельное
 * согласие documents_ai. Передаётся только обезличенный текст PDF/DOCX; фото документов не передаются,
 * потому что имя и ИИН на изображении скрыть нельзя.
 */
type DocsMode = 'none' | 'types_only' | 'text';
const docsModeFor = (p: Provider): DocsMode =>
  p === 'local' ? 'text' : p === 'openai' ? (docsExternalEnabled() ? 'text' : 'types_only') : 'none';

/** Согласия родителя, без которых скрининг не запускается */
const requiredConsents = async (parentId: Types.ObjectId, p: Provider): Promise<string[]> => {
  const [aiConsent, crossBorder, docsAi] = await Promise.all([
    hasActiveConsent(parentId, 'ai_screening'),
    hasActiveConsent(parentId, 'cross_border'),
    hasActiveConsent(parentId, 'documents_ai'),
  ]);
  return [
    ...(aiConsent ? [] : ['ai_screening']),
    ...(p === 'openai' && !crossBorder ? ['cross_border'] : []),
    ...(p === 'openai' && docsExternalEnabled() && !docsAi ? ['documents_ai'] : []),
  ];
};

const PERIOD_DAYS = () => Math.min(Math.max(Number(process.env.AI_SCREENING_PERIOD_DAYS) || 30, 7), 180);
const DAILY_LIMIT = () => Math.max(Number(process.env.AI_SCREENING_DAILY_LIMIT) || 5, 1);
const MAX_DOC_CHARS_TOTAL = 20_000;

// ─── Доступ ──────────────────────────────────────────────────────────────────

/** Скрининг запускает и смотрит родитель ребёнка или администратор */
const loadChild = async (req: AuthRequest, res: Response) => {
  const id = String(req.params['id']);
  if (!Types.ObjectId.isValid(id)) { res.status(400).json({ message: 'Некорректный идентификатор' }); return null; }
  const child = await Child.findById(id);
  if (!child) { res.status(404).json({ message: 'Child not found' }); return null; }
  const isOwner = child.parentId.toString() === req.user?.id;
  if (!isOwner && req.user?.role !== 'admin') { res.status(403).json({ message: 'Access denied' }); return null; }
  return child;
};

// ─── Типы документов (фиксированный словарь — во внешний ИИ не уходит свободный текст) ──

const DOC_KINDS: [RegExp, string][] = [
  [/пмпк|psychological.?medical/i, 'заключение ПМПК'],
  [/невролог|neurolog/i, 'заключение невролога'],
  [/психиатр|psychiatr/i, 'заключение психиатра'],
  [/логопед|speech/i, 'заключение логопеда'],
  [/дефектолог/i, 'заключение дефектолога'],
  [/психолог|psycholog/i, 'заключение психолога'],
  [/ээг|eeg/i, 'ЭЭГ'],
  [/мрт|mri/i, 'МРТ'],
  [/инвалидн|мсэ|disabilit/i, 'справка об инвалидности / МСЭ'],
  [/ипр|реабилит|rehab/i, 'программа реабилитации'],
  [/выписк|discharge/i, 'выписка'],
  [/анализ|lab/i, 'результаты анализов'],
  [/справк/i, 'справка'],
  [/заключени/i, 'медицинское заключение'],
];
const docKind = (fileName: string): string =>
  DOC_KINDS.find(([re]) => re.test(fileName))?.[1] ?? 'другой документ';

// ─── Промпт ──────────────────────────────────────────────────────────────────

const MISSING_SECTIONS = ['basic', 'sensory', 'fears', 'interests', 'goals', 'behavioral', 'skating', 'documents', 'observations', 'milestones'] as const;

const buildPrompt = (args: {
  child: any; scrub: Scrub; periodDays: number;
  emotions: any[]; activities: any[]; diary: any[]; milestones: any[];
  docKinds: string[]; docTexts: { kind: string; text: string }[]; docInsights: string[];
  parentNotes: number; trainerNotes: number;
}): string => {
  const { child, scrub } = args;
  const L: string[] = [];
  L.push('Ты — опытный специалист по развитию детей с особыми образовательными потребностями (нейропсихолог, дефектолог).');
  L.push('Проведи СКРИНИНГ: проанализируй данные о ребёнке и подготовь структурированный отчёт для родителя и тренера по адаптивному катанию.');
  L.push('ВАЖНО: это не медицинский диагноз. Не ставь и не предполагай диагнозы, не назначай лечение и препараты.');
  L.push('Если видишь поводы для беспокойства — рекомендуй обратиться к профильному специалисту. Опирайся только на приведённые данные.');
  L.push('');
  L.push('=== ПРОФИЛЬ РЕБЁНКА (обезличен) ===');
  L.push(...childProfileLines(child, scrub));
  if (child.goals?.length) L.push(`Цели родителя: ${child.goals.map((g: any) => scrub(`${g.title}${g.description ? ` (${g.description})` : ''}`)).join('; ')}`);
  const ski = child.skiExperience;
  if (ski && typeof ski.hasExperience === 'boolean') {
    L.push(`Катался(ась) на лыжах или обучался(ась): ${ski.hasExperience ? `да${ski.when ? `, ${scrub(ski.when)}` : ''}` : 'нет'}`);
  }
  const sk = child.adaptiveSkating;
  if (sk && typeof sk.hasExperience === 'boolean') {
    L.push(`Опыт адаптивного катания: ${sk.hasExperience ? `да${sk.when ? `, ${scrub(sk.when)}` : ''}${sk.details ? ` — ${scrub(sk.details)}` : ''}` : 'нет'}`);
  }

  L.push('');
  L.push('=== СЕМЬЯ И НАБЛЮДАТЕЛИ ===');
  L.push('Данные вносит родитель (законный представитель).');
  L.push(`Записей родителя за период: ${args.parentNotes}; записей тренеров: ${args.trainerNotes}.`);

  if (args.emotions.length) {
    L.push('');
    L.push(`=== ЭМОЦИИ (за ${args.periodDays} дн.) ===`);
    args.emotions.forEach((e) => L.push(`- ${MOOD_RU[e.mood] ?? e.mood} (${e.intensity}/5)${e.comment ? ` — «${scrub(e.comment)}»` : ''} · ${daysAgoLabel(e.createdAt)}`));
  }
  if (args.activities.length) {
    L.push('');
    L.push(`=== АКТИВНОСТИ (за ${args.periodDays} дн.) ===`);
    args.activities.forEach((a) => L.push(`- ${scrub(a.name)} (${CAT_RU[a.category] ?? a.category}${a.duration ? `, ${a.duration} мин` : ''})${a.notes ? ` — «${scrub(a.notes)}»` : ''} · ${daysAgoLabel(a.date)}`));
  }
  if (args.diary.length) {
    L.push('');
    L.push(`=== ДНЕВНИК НАБЛЮДЕНИЙ (за ${args.periodDays} дн.) ===`);
    args.diary.forEach((d) => L.push(`- [${TAG_RU[d.tag] ?? d.tag}${d.author?.role === 'trainer' ? ', тренер' : ''}] «${scrub(d.text)}» · ${daysAgoLabel(d.createdAt)}`));
  }
  if (args.milestones.length) {
    const ST: Record<string, string> = { achieved: 'освоено', in_progress: 'в процессе', not_yet: 'пока нет' };
    L.push('');
    L.push('=== ВЕХИ РАЗВИТИЯ ===');
    args.milestones.forEach((m) => L.push(`- ${m.milestoneId?.direction ?? ''}: ${m.milestoneId?.skill ?? ''} — ${ST[m.status] ?? m.status}`));
  }
  L.push('');
  L.push('=== ДОКУМЕНТЫ ===');
  if (!args.docKinds.length) L.push('Документы не загружены.');
  else L.push(`Загружены: ${args.docKinds.join(', ')}.`);
  if (args.docInsights.length) {
    L.push('Расшифровки медицинских документов (подготовлены ранее, обезличены):');
    L.push(...args.docInsights);
  }
  args.docTexts.forEach((d, i) => {
    L.push(`--- Документ ${i + 1} (текст обезличен) ---`);
    L.push(d.text);
  });

  L.push('');
  L.push('=== ФОРМАТ ОТВЕТА ===');
  L.push('Ответь ТОЛЬКО JSON-объектом на русском языке, без markdown:');
  L.push(`{
  "summary": "2–4 предложения: общая картина",
  "strengths": ["сильная сторона", "..."],
  "attentionAreas": [{"area": "сфера (сенсорика, коммуникация, моторика, эмоции, поведение, самообслуживание…)", "observation": "что видно по данным", "level": "low|medium|high"}],
  "risks": ["на что обратить внимание, чтобы не ухудшить состояние", "..."],
  "recommendationsParent": ["конкретный совет родителю", "..."],
  "recommendationsTrainer": ["конкретный совет тренеру на занятии", "..."],
  "specialists": [{"specialist": "кто", "reason": "зачем"}],
  "missingData": [{"section": "${MISSING_SECTIONS.join('|')}", "why": "каких данных не хватает и зачем они"}]
}`);
  L.push('Правила: 3–6 пунктов в списках; советы конкретные и персональные; если данных мало — честно скажи об этом в summary и missingData.');
  return L.join('\n');
};

// ─── Валидация ответа ИИ ──────────────────────────────────────────────────────

const strArr = (v: unknown, max = 8): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 600)).slice(0, max) : [];

const parseResult = (raw: string): IScreeningResult | null => {
  let obj: any;
  try {
    obj = JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || typeof obj.summary !== 'string') return null;
  const level = (l: unknown) => (l === 'high' || l === 'medium' ? l : 'low') as 'low' | 'medium' | 'high';
  return {
    summary: obj.summary.trim().slice(0, 2000),
    strengths: strArr(obj.strengths),
    attentionAreas: (Array.isArray(obj.attentionAreas) ? obj.attentionAreas : [])
      .filter((a: any) => a && typeof a.area === 'string')
      .slice(0, 8)
      .map((a: any) => ({ area: String(a.area).slice(0, 120), observation: String(a.observation ?? '').slice(0, 600), level: level(a.level) })),
    risks: strArr(obj.risks),
    recommendationsParent: strArr(obj.recommendationsParent),
    recommendationsTrainer: strArr(obj.recommendationsTrainer),
    specialists: (Array.isArray(obj.specialists) ? obj.specialists : [])
      .filter((s: any) => s && typeof s.specialist === 'string')
      .slice(0, 6)
      .map((s: any) => ({ specialist: String(s.specialist).slice(0, 120), reason: String(s.reason ?? '').slice(0, 400) })),
    missingData: (Array.isArray(obj.missingData) ? obj.missingData : [])
      .filter((m: any) => m && typeof m.why === 'string')
      .slice(0, 10)
      .map((m: any) => ({
        section: (MISSING_SECTIONS as readonly string[]).includes(m.section) ? m.section : 'basic',
        why: String(m.why).slice(0, 400),
      })),
  };
};

// ─── Контроллеры ─────────────────────────────────────────────────────────────

// GET /api/children/:id/screening/status — можно ли запускать и каких согласий не хватает
export const getScreeningStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await loadChild(req, res);
    if (!child) return;
    const provider = providerName();
    const missingConsents = await requiredConsents(child.parentId, provider);
    res.json({
      provider,
      enabled: provider !== 'off' && !!getClient(provider),
      documentsMode: docsModeFor(provider),
      missingConsents,
      dailyLimit: DAILY_LIMIT(),
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/children/:id/screening — запуск
export const runScreening = async (req: AuthRequest, res: Response): Promise<void> => {
  let screeningId: Types.ObjectId | null = null;
  try {
    const child = await loadChild(req, res);
    if (!child) return;

    const provider = providerName();
    const ai = getClient(provider);
    if (provider === 'off' || !ai) {
      res.status(503).json({ message: 'ИИ-скрининг сейчас недоступен: он не настроен на сервере. Обратитесь к администратору.' });
      return;
    }

    // Согласия даёт родитель (законный представитель), даже если запускает администратор
    const missingConsents = await requiredConsents(child.parentId, provider);
    if (missingConsents.length) {
      res.status(403).json({ code: 'CONSENT_REQUIRED', missingConsents, message: 'Нужно согласие родителя на ИИ-скрининг' });
      return;
    }

    // Лимит запусков в сутки на ребёнка (запросы к ИИ платные и медленные)
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const runs = await Screening.countDocuments({ childId: child._id, createdAt: { $gte: dayAgo } });
    if (runs >= DAILY_LIMIT()) {
      res.status(429).json({ message: `Не больше ${DAILY_LIMIT()} скринингов в сутки для одного ребёнка. Попробуйте завтра.` });
      return;
    }

    const periodDays = PERIOD_DAYS();
    const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000);
    const [emotions, activities, diary, milestones, docs, people] = await Promise.all([
      Emotion.find({ childId: child._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(40).lean(),
      Activity.find({ childId: child._id, date: { $gte: since } }).sort({ date: -1 }).limit(40).lean(),
      DiaryEntry.find({ childId: child._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(30).populate('author', 'role').lean(),
      ChildMilestone.find({ childId: child._id }).populate('milestoneId', 'skill direction').lean(),
      DocumentModel.find({ childId: child._id, status: 'ready' }).sort({ createdAt: -1 }).limit(10).lean(),
      User.find({ _id: { $in: [child.parentId, ...(child.trainers ?? [])] } }).select('name').lean(),
    ]);

    // Имена ребёнка, родителя и тренеров скрываются в любом свободном тексте
    const scrub = makeScrubber([child.name, child.lastName ?? '', ...people.map((p) => p.name)]);

    // Документы: локальный ИИ (РК) — обезличенный текст; внешний — только типы по словарю,
    // либо обезличенный текст PDF/DOCX, если это включено оператором и родитель дал согласие documents_ai
    const docsMode = docsModeFor(provider);
    const docKinds = [...new Set(docs.map((d) => docKind(d.fileName)))];
    const docTexts: { kind: string; text: string }[] = [];
    // Готовые ИИ-расшифровки документов — только при согласии родителя на анализ документов
    const docInsights = (await hasActiveConsent(child.parentId, 'documents_ai'))
      ? await documentInsightLines(child._id, scrub)
      : [];
    let documentsSkipped = 0;
    if (docsMode === 'text') {
      let total = 0;
      for (const d of docs) {
        if (total >= MAX_DOC_CHARS_TOTAL) { documentsSkipped++; continue; }
        // Во внешний ИИ фото документов не передаём: имя и ИИН на изображении не скрыть
        if (provider !== 'local' && String(d.mimeType).startsWith('image/')) { documentsSkipped++; continue; }
        try {
          const ex = await extractDocumentText(d as any);
          if (!ex) { documentsSkipped++; continue; }
          const text = scrub(ex.text).slice(0, MAX_DOC_CHARS_TOTAL - total);
          total += text.length;
          docTexts.push({ kind: docKind(d.fileName), text });
        } catch (err) {
          console.warn('[screening] document skipped:', (err as Error).message);
          documentsSkipped++;
        }
      }
    }

    const diaryParent = diary.filter((d: any) => d.author?.role !== 'trainer').length;
    const sections = [
      'профиль',
      ...(child.sensoryProfile && Object.values(child.sensoryProfile).some(Boolean) ? ['сенсорный профиль'] : []),
      ...(child.goals?.length ? ['цели'] : []),
      ...(emotions.length ? ['эмоции'] : []),
      ...(activities.length ? ['активности'] : []),
      ...(diary.length ? ['дневник'] : []),
      ...(milestones.length ? ['вехи развития'] : []),
      ...(docs.length ? [docTexts.length ? 'текст документов' : 'типы документов'] : []),
      ...(docInsights.length ? ['расшифровки документов'] : []),
    ];

    const screening = await Screening.create({
      childId: child._id,
      requestedBy: req.user!.id,
      provider,
      aiModel: ai.model,
      status: 'pending',
      consentVersion: CONSENT_VERSION,
      inputSummary: {
        sections,
        periodDays,
        counts: { emotions: emotions.length, activities: activities.length, diary: diary.length, milestones: milestones.length, documents: docs.length },
        documentsMode: !docs.length ? 'none' : docTexts.length ? 'text' : 'types_only',
        ...(documentsSkipped ? { documentsSkipped } : {}),
      },
    });
    screeningId = screening._id as Types.ObjectId;
    await logAccess(req, { action: 'screening.run', childId: child._id, meta: { screeningId: String(screening._id), provider } });

    const prompt = buildPrompt({
      child, scrub, periodDays, emotions, activities, diary, milestones, docKinds, docTexts, docInsights,
      parentNotes: emotions.length + activities.length + diaryParent,
      trainerNotes: diary.length - diaryParent,
    });

    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    const result = parseResult((completion.choices[0]?.message?.content ?? '').trim());
    if (!result) {
      screening.status = 'failed';
      screening.error = 'ИИ вернул ответ в неверном формате';
      await screening.save();
      res.status(502).json({ message: 'ИИ вернул ответ в неверном формате. Попробуйте ещё раз.', screening });
      return;
    }
    screening.status = 'done';
    screening.result = result;
    await screening.save();
    res.status(201).json(screening);
  } catch (err: any) {
    console.error('[screening] error:', err?.message ?? err);
    const message = aiErrorMessage(err, 'Не удалось выполнить скрининг. Попробуйте позже.');
    if (screeningId) {
      await Screening.updateOne({ _id: screeningId }, { status: 'failed', error: message }).catch(() => {});
    }
    res.status(err?.status ? 502 : 500).json({ message });
  }
};

// GET /api/children/:id/screening — история (без полного отчёта)
export const listScreenings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await loadChild(req, res);
    if (!child) return;
    const list = await Screening.find({ childId: child._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('status provider aiModel createdAt inputSummary error result.summary')
      .lean();
    res.json(list);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/children/:id/screening/:screeningId — отчёт
export const getScreening = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await loadChild(req, res);
    if (!child) return;
    const sid = String(req.params['screeningId']);
    if (!Types.ObjectId.isValid(sid)) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
    const screening = await Screening.findOne({ _id: sid, childId: child._id }).lean();
    if (!screening) { res.status(404).json({ message: 'Отчёт не найден' }); return; }
    await logAccess(req, { action: 'screening.view', childId: child._id, meta: { screeningId: sid } });
    res.json(screening);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
