import OpenAI from 'openai';

/**
 * Общие настройки ИИ-провайдера для скрининга, расшифровки документов и рекомендаций.
 *
 * AI_SCREENING_PROVIDER:
 *  • openai (по умолчанию) — внешний ИИ за пределами РК (только обезличенные данные)
 *  • local  — OpenAI-совместимая модель в РК: AI_LOCAL_BASE_URL, AI_LOCAL_MODEL, AI_LOCAL_API_KEY
 *  • off    — ИИ выключен
 *
 * AI_SCREENING_DOCS_EXTERNAL=true — разрешить передачу обезличенного ТЕКСТА документов во внешний ИИ.
 * AI_DOCS_IMAGES_EXTERNAL=true    — разрешить передачу ФОТО документов во внешний ИИ (распознавание
 *   изображения). На фото нельзя скрыть ФИО и ИИН — включайте только по решению юриста; работает
 *   при согласии родителя documents_ai.
 */

export type Provider = 'openai' | 'local' | 'off';

export const providerName = (): Provider => {
  const p = (process.env.AI_SCREENING_PROVIDER || 'openai').toLowerCase();
  return p === 'local' || p === 'off' ? p : 'openai';
};

export const docsExternalEnabled = () => process.env.AI_SCREENING_DOCS_EXTERNAL === 'true';
export const docsImagesExternalEnabled = () => process.env.AI_DOCS_IMAGES_EXTERNAL === 'true';

export const getClient = (p: Provider): { client: OpenAI; model: string; visionModel: string } | null => {
  if (p === 'local') {
    const baseURL = process.env.AI_LOCAL_BASE_URL;
    const model = process.env.AI_LOCAL_MODEL;
    if (!baseURL || !model) return null;
    return { client: new OpenAI({ baseURL, apiKey: process.env.AI_LOCAL_API_KEY || 'local' }), model, visionModel: model };
  }
  if (p === 'openai') {
    if (!process.env.OPENAI_API_KEY) return null;
    const model = process.env.AI_SCREENING_MODEL || 'gpt-4o-mini';
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model, visionModel: process.env.AI_VISION_MODEL || model };
  }
  return null;
};

/** Понятный текст для типичных ошибок ИИ */
export const aiErrorMessage = (err: any, fallback = 'Не удалось выполнить запрос к ИИ. Попробуйте позже.'): string => {
  const status = err?.status;
  if (status === 401 || err?.code === 'invalid_api_key') return 'Ключ доступа к ИИ (OPENAI_API_KEY) недействителен. Обратитесь к администратору.';
  if (status === 429 || err?.code === 'insufficient_quota') return 'Исчерпан лимит или баланс аккаунта ИИ. Обратитесь к администратору.';
  if (status && status >= 500) return 'Сервис ИИ временно недоступен. Попробуйте через несколько минут.';
  return fallback;
};

/** Разбор JSON из ответа модели (на случай обёртки в ```json) */
export const parseJson = (raw: string): any | null => {
  try {
    return JSON.parse(String(raw ?? '').trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
  } catch {
    return null;
  }
};

export const strArr = (v: unknown, max = 8, len = 600): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, len)).slice(0, max) : [];
