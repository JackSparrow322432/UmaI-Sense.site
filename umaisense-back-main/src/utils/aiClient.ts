import OpenAI from 'openai';

/**
 * Общие настройки ИИ-провайдера для скрининга, расшифровки документов и рекомендаций.
 *
 * AI_SCREENING_PROVIDER:
 *  • off    — ИИ выключен (по умолчанию в production, если не настроено иное)
 *  • yandex — Yandex AI Studio (YandexGPT), OpenAI-совместимый API: AI_YANDEX_BASE_URL, AI_YANDEX_API_KEY,
 *             AI_YANDEX_FOLDER_ID, AI_YANDEX_MODEL. Считается «в Казахстане», только если адрес API
 *             в зоне yandexcloud.kz — иначе это зарубежная обработка.
 *  • local  — своя OpenAI-совместимая модель в РК (vLLM, Ollama): AI_LOCAL_BASE_URL, AI_LOCAL_MODEL
 *  • openai — OpenAI (США). ЗАРУБЕЖНАЯ обработка: в production работает только при ALLOW_FOREIGN_AI=true
 *
 * AI_SCREENING_DOCS_EXTERNAL=true — разрешить передачу обезличенного ТЕКСТА документов во внешний ИИ.
 * AI_DOCS_IMAGES_EXTERNAL=true    — разрешить передачу ФОТО документов во внешний ИИ (vision).
 */

export type Provider = 'openai' | 'yandex' | 'local' | 'off';

const isProd = () => process.env.NODE_ENV === 'production';
// Значения из панелей хостинга часто приходят с пробелами, кавычками или переводом строки
const env = (k: string): string => String(process.env[k] ?? '').trim().replace(/^["']|["']$/g, '').trim();
const envTrue = (k: string): boolean => ['true', '1', 'yes', 'on'].includes(env(k).toLowerCase());

export const providerName = (): Provider => {
  const p = (env('AI_SCREENING_PROVIDER') || (isProd() ? 'off' : 'openai')).toLowerCase();
  return p === 'local' || p === 'off' || p === 'yandex' ? p : 'openai';
};

const hostOf = (url?: string) => {
  try { return url ? new URL(url).hostname : ''; } catch { return ''; }
};

/** Обрабатываются ли данные провайдером на территории Казахстана */
export const isProviderInKz = (p: Provider): boolean => {
  if (p === 'local') return true; // своя модель — по определению на своих серверах в РК
  if (p === 'yandex') return /(^|\.)yandexcloud\.kz$/.test(hostOf(process.env.AI_YANDEX_BASE_URL));
  return false;
};

/** Разрешена ли зарубежная обработка (OpenAI или Yandex вне региона KZ) */
export const foreignAiAllowed = () => !isProd() || envTrue('ALLOW_FOREIGN_AI');

export const docsExternalEnabled = () => envTrue('AI_SCREENING_DOCS_EXTERNAL');
export const docsImagesExternalEnabled = () => envTrue('AI_DOCS_IMAGES_EXTERNAL');

export const getClient = (p: Provider): { client: OpenAI; model: string; visionModel: string } | null => {
  if (p === 'off') return null;
  // Зарубежный провайдер без явного разрешения не используется — данные не покидают РК
  if (!isProviderInKz(p) && !foreignAiAllowed()) return null;

  if (p === 'local') {
    const baseURL = process.env.AI_LOCAL_BASE_URL;
    const model = process.env.AI_LOCAL_MODEL;
    if (!baseURL || !model) return null;
    return { client: new OpenAI({ baseURL, apiKey: process.env.AI_LOCAL_API_KEY || 'local' }), model, visionModel: model };
  }
  if (p === 'yandex') {
    const baseURL = process.env.AI_YANDEX_BASE_URL;
    const apiKey = process.env.AI_YANDEX_API_KEY;
    const folder = process.env.AI_YANDEX_FOLDER_ID;
    if (!baseURL || !apiKey || !folder) return null;
    const name = process.env.AI_YANDEX_MODEL || 'yandexgpt/latest';
    const model = name.startsWith('gpt://') ? name : `gpt://${folder}/${name}`;
    return { client: new OpenAI({ baseURL, apiKey, project: folder }), model, visionModel: model };
  }
  const key = env('OPENAI_API_KEY');
  if (!key) return null;
  const model = env('AI_SCREENING_MODEL') || 'gpt-4o-mini';
  return { client: new OpenAI({ apiKey: key }), model, visionModel: env('AI_VISION_MODEL') || model };
};

/** Почему ИИ не работает — понятная подсказка для администратора (без значений секретов) */
export const aiConfigProblem = (): string | null => {
  const p = providerName();
  if (p === 'off') {
    return env('AI_SCREENING_PROVIDER')
      ? 'AI_SCREENING_PROVIDER=off — ИИ выключен'
      : 'не задана переменная AI_SCREENING_PROVIDER (на рабочем сервере ИИ по умолчанию выключен) — укажите openai';
  }
  if (!isProviderInKz(p) && !foreignAiAllowed()) return `ALLOW_FOREIGN_AI не равна true — ${p} работает за пределами РК и без этого флага выключен`;
  if (p === 'openai' && !env('OPENAI_API_KEY')) return 'не задана переменная OPENAI_API_KEY';
  if (p === 'local' && (!env('AI_LOCAL_BASE_URL') || !env('AI_LOCAL_MODEL'))) return 'не заданы AI_LOCAL_BASE_URL / AI_LOCAL_MODEL';
  if (p === 'yandex' && (!env('AI_YANDEX_BASE_URL') || !env('AI_YANDEX_API_KEY') || !env('AI_YANDEX_FOLDER_ID'))) return 'не заданы AI_YANDEX_BASE_URL / AI_YANDEX_API_KEY / AI_YANDEX_FOLDER_ID';
  return null;
};

/** Понятный текст для типичных ошибок ИИ */
export const aiErrorMessage = (err: any, fallback = 'Не удалось выполнить запрос к ИИ. Попробуйте позже.'): string => {
  const status = err?.status;
  if (status === 401 || err?.code === 'invalid_api_key') return 'Ключ доступа к ИИ недействителен. Обратитесь к администратору.';
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
