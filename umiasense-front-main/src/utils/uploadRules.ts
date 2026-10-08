/**
 * Правила загрузки файлов — ОДИН источник для подсказок в рамке загрузки, атрибута accept
 * и проверки на клиенте. Должны совпадать с сервером:
 * umaisense-back-main/src/utils/fileTypes.ts (IMAGE_TYPES, DOCUMENT_TYPES, IMAGE_PURPOSES).
 * Проверка на клиенте — только для удобства, главная проверка всегда на сервере.
 */

export type UploadKind = 'avatar' | 'cover' | 'submission' | 'document';

export interface UploadRule {
  /** Назначение для сервера (?purpose=) — только для изображений */
  purpose?: 'avatar' | 'cover' | 'submission';
  /** MIME → расширения */
  types: Record<string, string[]>;
  formatsLabel: string;
  maxBytes: number;
  /** Минимальное разрешение (только для изображений, кроме HEIC — его браузер не читает) */
  minWidth?: number;
  minHeight?: number;
  /** Текст подсказки в рамке загрузки */
  hint: string;
}

const MB = 1024 * 1024;

const IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
  'image/avif': ['avif'],
};

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  avatar: {
    purpose: 'avatar',
    types: IMAGE_TYPES,
    formatsLabel: 'JPG, PNG, WebP, GIF, HEIC, AVIF',
    maxBytes: 5 * MB,
    minWidth: 200,
    minHeight: 200,
    hint: 'Форматы: JPG, PNG, WebP, GIF, HEIC, AVIF · до 5 МБ · рекомендуемое разрешение от 400×400 px, квадратное фото (1:1) · минимум 200×200 px',
  },
  cover: {
    purpose: 'cover',
    types: { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/avif': ['avif'], 'image/heic': ['heic'], 'image/heif': ['heif'] },
    formatsLabel: 'JPG, PNG, WebP, AVIF, HEIC',
    maxBytes: 5 * MB,
    minWidth: 600,
    minHeight: 315,
    hint: 'Форматы: JPG, PNG, WebP, AVIF, HEIC · до 5 МБ · рекомендуемое разрешение 1200×630 px (горизонтальное, ~16:9) · минимум 600×315 px',
  },
  submission: {
    purpose: 'submission',
    types: IMAGE_TYPES,
    formatsLabel: 'JPG, PNG, WebP, GIF, HEIC, AVIF',
    maxBytes: 5 * MB,
    minWidth: 200,
    minHeight: 200,
    hint: 'Фото выполненного задания · JPG, PNG, WebP, GIF, HEIC, AVIF · до 5 МБ · минимум 200×200 px, лучше от 1000 px по длинной стороне',
  },
  document: {
    types: {
      'application/pdf': ['pdf'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'image/heic': ['heic'],
      'image/heif': ['heif'],
    },
    formatsLabel: 'PDF, DOC, DOCX, JPG, PNG, WebP, HEIC',
    maxBytes: 20 * MB,
    hint: 'Форматы: PDF, DOC, DOCX, JPG, PNG, WebP, HEIC · до 20 МБ (пока сервис на Vercel — до 10 МБ) · фото и сканы документов — от 1200 px по длинной стороне, текст должен читаться',
  },
};

/** Значение атрибута accept для <input type="file"> */
export const acceptFor = (rule: UploadRule): string =>
  [...Object.keys(rule.types), ...Object.values(rule.types).flat().map((e) => `.${e}`)].join(',');

/** MIME по файлу: браузеры часто не знают HEIC/DOCX и присылают пустой type */
export const guessMime = (rule: UploadRule, file: File): string => {
  if (file.type && rule.types[file.type]) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return Object.entries(rule.types).find(([, exts]) => exts.includes(ext))?.[0] ?? file.type;
};

const formatMb = (bytes: number) => `${Math.round(bytes / MB)} МБ`;

/** Размер изображения в пикселях (null — браузер не умеет читать формат, например HEIC) */
const readDimensions = (file: File): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });

/** Проверка файла на клиенте. Возвращает текст ошибки или null. */
export const validateFile = async (rule: UploadRule, file: File): Promise<string | null> => {
  const mime = guessMime(rule, file);
  if (!rule.types[mime]) return `Неподходящий формат. Можно: ${rule.formatsLabel}`;
  if (file.size > rule.maxBytes) return `Файл больше ${formatMb(rule.maxBytes)}`;
  if (rule.minWidth && mime.startsWith('image/') && mime !== 'image/heic' && mime !== 'image/heif') {
    const dim = await readDimensions(file);
    if (dim && (dim.width < rule.minWidth || dim.height < (rule.minHeight ?? 0))) {
      return `Слишком маленькое изображение (${dim.width}×${dim.height} px). Минимум — ${rule.minWidth}×${rule.minHeight} px`;
    }
  }
  return null;
};
