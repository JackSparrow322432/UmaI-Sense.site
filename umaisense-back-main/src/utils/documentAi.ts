import sharp from 'sharp';
import convertHeic from 'heic-convert';
import { Types } from 'mongoose';
import DocumentModel from '../models/Document';
import { DocumentAiResult } from '../types';
import { getClient, Provider, providerName, docsExternalEnabled, docsImagesExternalEnabled, parseJson, strArr } from './aiClient';
import { extractDocumentText } from './documentText';
import { downloadStored, isProviderAvailable, StorageProvider } from './documentStorage';
import { hasActiveConsent } from './consent';
import { Scrub } from './anonymize';

/**
 * ИИ-расшифровка медицинского документа ребёнка: объяснение простыми словами, термины,
 * что рекомендовано, вопросы врачу, что важно тренеру. Новых диагнозов ИИ не ставит.
 *
 * Что уходит в ИИ:
 *  • PDF/DOCX — извлечённый текст, из которого удалены имена, ИИН, телефоны, email, даты;
 *  • фото/сканы — изображение целиком (имя на картинке не скрыть), поэтому во внешний ИИ
 *    только при AI_DOCS_IMAGES_EXTERNAL=true; в локальной модели (РК) — текст через OCR.
 * Ответ модели дополнительно обезличивается перед сохранением.
 */

export class DocumentAiError extends Error {
  constructor(message: string, public status = 400, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

const MAX_TEXT = 15_000;

const SYSTEM = `Ты — опытный педиатр и детский невролог. Родитель ребёнка с особыми потребностями загрузил медицинский документ.
Объясни его простым, спокойным и понятным языком, без запугивания.
Правила:
- объясняй ТОЛЬКО то, что написано в документе; не ставь новых диагнозов, не назначай лечение и препараты;
- если что-то в документе неразборчиво или неясно — так и скажи;
- не указывай ФИО, ИИН, адреса, номера документов и даты рождения, даже если они видны;
- весь текст на русском языке.
Ответь ТОЛЬКО JSON-объектом:
{
  "docType": "вид документа (например: заключение невролога, выписка из стационара, заключение ПМПК, результаты анализов)",
  "summary": "3–5 предложений: что это за документ и что в нём главное, простыми словами",
  "keyFindings": ["главные выводы и показатели из документа, каждый — понятной фразой"],
  "terms": [{"term": "медицинский термин или сокращение из документа", "meaning": "что это значит простыми словами"}],
  "recommendations": ["что рекомендовано в самом документе (обследования, занятия, режим, наблюдение)"],
  "questionsForDoctor": ["вопросы, которые стоит задать лечащему врачу"],
  "forTrainer": ["что из документа важно знать тренеру по адаптивному катанию для безопасных занятий"]
}`;

const toResult = (obj: any, scrub: Scrub): DocumentAiResult | null => {
  if (!obj || typeof obj !== 'object' || typeof obj.summary !== 'string') return null;
  const s = (v: unknown, n = 600) => scrub(String(v ?? '').trim()).slice(0, n);
  const arr = (v: unknown, max = 10) => strArr(v, max).map((x) => scrub(x));
  return {
    docType: s(obj.docType, 150) || 'медицинский документ',
    summary: s(obj.summary, 2000),
    keyFindings: arr(obj.keyFindings, 12),
    terms: (Array.isArray(obj.terms) ? obj.terms : [])
      .filter((t: any) => t && typeof t.term === 'string')
      .slice(0, 15)
      .map((t: any) => ({ term: s(t.term, 120), meaning: s(t.meaning, 400) })),
    recommendations: arr(obj.recommendations),
    questionsForDoctor: arr(obj.questionsForDoctor, 8),
    forTrainer: arr(obj.forTrainer, 8),
  };
};

/** Какие согласия родителя нужны для расшифровки документов */
export const documentAiMissingConsents = async (parentId: Types.ObjectId | string, p: Provider): Promise<string[]> => {
  const [docsAi, crossBorder] = await Promise.all([
    hasActiveConsent(parentId, 'documents_ai'),
    hasActiveConsent(parentId, 'cross_border'),
  ]);
  return [...(docsAi ? [] : ['documents_ai']), ...(p === 'openai' && !crossBorder ? ['cross_border'] : [])];
};

/** Готова ли расшифровка документов на этом сервере (без учёта согласий) */
export const documentAiAvailability = (): { enabled: boolean; images: boolean; reason?: string } => {
  const p = providerName();
  if (p === 'off' || !getClient(p)) return { enabled: false, images: false, reason: 'ИИ не настроен на сервере' };
  if (p === 'openai' && !docsExternalEnabled()) {
    return { enabled: false, images: false, reason: 'Расшифровка документов внешним ИИ не включена (AI_SCREENING_DOCS_EXTERNAL)' };
  }
  return { enabled: true, images: p === 'local' || docsImagesExternalEnabled() };
};

const imageDataUrl = async (buf: Buffer, mimeType: string): Promise<string> => {
  let input = buf;
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    input = Buffer.from(await convertHeic({ buffer: buf, format: 'JPEG', quality: 0.9 }));
  }
  // Поворот по EXIF, без метаданных, до 2000 px — достаточно для чтения текста
  const jpeg = await sharp(input, { limitInputPixels: 60_000_000 }).rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
};

/** Расшифровывает документ, сохраняет результат в документе и возвращает его */
export const explainDocument = async (documentId: string, childId: string, scrub: Scrub): Promise<DocumentAiResult> => {
  const avail = documentAiAvailability();
  if (!avail.enabled) throw new DocumentAiError(`Расшифровка документов недоступна: ${avail.reason}. Обратитесь к администратору.`, 503);
  const p = providerName();
  const ai = getClient(p)!;

  const doc = await DocumentModel.findOne({ _id: documentId, childId, status: 'ready' });
  if (!doc) throw new DocumentAiError('Документ не найден', 404);
  const isImage = doc.mimeType.startsWith('image/');
  if (doc.mimeType === 'application/msword') {
    throw new DocumentAiError('Старый формат Word (.doc) не поддерживается — сохраните документ как PDF или DOCX и загрузите снова.', 422);
  }
  if (isImage && !avail.images) {
    throw new DocumentAiError('Фото и сканы документов не отправляются во внешний ИИ (на изображении нельзя скрыть ФИО и ИИН). Загрузите документ в PDF или Word.', 422, 'IMAGE_NOT_ALLOWED');
  }

  doc.aiStatus = 'pending';
  doc.aiError = undefined;
  await doc.save();

  try {
    let messages: any[];
    if (isImage && p === 'openai') {
      const provider: StorageProvider = doc.storageProvider === 'cloudinary' ? 'cloudinary' : 's3';
      if (!doc.storageKey || !isProviderAvailable(provider)) throw new DocumentAiError('Файл документа недоступен в хранилище', 503);
      const url = await imageDataUrl(await downloadStored(provider, doc.storageKey), doc.mimeType);
      messages = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: [
          { type: 'text', text: 'Расшифруй этот медицинский документ ребёнка (фото).' },
          { type: 'image_url', image_url: { url, detail: 'high' } },
        ] },
      ];
    } else {
      const ex = await extractDocumentText(doc as any);
      if (!ex || ex.text.trim().length < 20) {
        throw new DocumentAiError('Не удалось прочитать текст документа. Если это скан, загрузите более чёткий файл или PDF с текстом.', 422);
      }
      messages = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Текст медицинского документа ребёнка (персональные данные скрыты):\n\n${scrub(ex.text).slice(0, MAX_TEXT)}` },
      ];
    }

    const completion = await ai.client.chat.completions.create({
      model: isImage ? ai.visionModel : ai.model,
      messages,
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });
    const result = toResult(parseJson(completion.choices[0]?.message?.content ?? ''), scrub);
    if (!result) throw new DocumentAiError('ИИ вернул ответ в неверном формате. Попробуйте ещё раз.', 502);

    doc.aiStatus = 'done';
    doc.aiResult = result;
    doc.aiExplanation = result.summary;
    doc.aiAt = new Date();
    await doc.save();
    return result;
  } catch (err: any) {
    doc.aiStatus = 'failed';
    doc.aiError = err instanceof DocumentAiError ? err.message : 'Ошибка обращения к ИИ';
    await doc.save().catch(() => {});
    throw err;
  }
};

/**
 * Краткие строки из готовых расшифровок документов — для ИИ-рекомендаций и скрининга.
 * Это уже обезличенный текст, сформированный ИИ; повторно прогоняется через scrub.
 */
export const documentInsightLines = async (childId: Types.ObjectId | string, scrub: Scrub, limit = 6): Promise<string[]> => {
  const docs = await DocumentModel.find({ childId, aiStatus: 'done', aiResult: { $exists: true } })
    .sort({ aiAt: -1 }).limit(limit).select('aiResult aiAt').lean();
  const L: string[] = [];
  for (const d of docs as any[]) {
    const r: DocumentAiResult | undefined = d.aiResult;
    if (!r?.summary) continue;
    L.push(`- ${scrub(r.docType)}: ${scrub(r.summary)}`);
    if (r.keyFindings?.length) L.push(`  Главное: ${r.keyFindings.slice(0, 6).map(scrub).join('; ')}`);
    if (r.recommendations?.length) L.push(`  Рекомендовано в документе: ${r.recommendations.slice(0, 5).map(scrub).join('; ')}`);
  }
  return L;
};
