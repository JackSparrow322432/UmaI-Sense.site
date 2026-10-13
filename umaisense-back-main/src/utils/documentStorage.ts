import {
  isS3Enabled, presignPrivateUpload, presignPrivateDownload, headPrivateObject,
  readPrivateHead, deletePrivateObject, getPrivateObject,
} from './storage';
import { MAX_DOCUMENT_SIZE } from './fileTypes';

/**
 * Хранилище документов детей — ТОЛЬКО S3-совместимое хранилище в Казахстане
 * (Yandex Object Storage, регион kz1: https://storage.yandexcloud.kz).
 *
 * Cloudinary (зарубежный сервис) для новых файлов не используется. У старых записей может остаться
 * storageProvider = 'cloudinary' — их переносит скрипт `npm run migrate:files`. ДО переноса старые файлы
 * можно только ЧИТАТЬ (открыть, передать на расшифровку ИИ), если заданы CLOUDINARY_* (переходный период;
 * в Yandex Cloud KZ сервер с CLOUDINARY_* не запустится, а пакет cloudinary в образ не входит).
 */

export type StorageProvider = 's3' | 'cloudinary';

export class LegacyStorageError extends Error {
  constructor() {
    super('Документ ещё не перенесён в хранилище в Казахстане (старый Cloudinary). Обратитесь к администратору.');
  }
}

const assertS3 = (p: StorageProvider) => {
  if (p !== 's3') throw new LegacyStorageError();
};

/** Хранилище для НОВЫХ документов */
export const activeProvider = (): StorageProvider | null => (isS3Enabled() ? 's3' : null);

export const isProviderAvailable = (p: StorageProvider): boolean => p === 's3' && isS3Enabled();

// ─── Старые файлы в Cloudinary: только чтение, на переходный период ─────────────
const legacy = (): any => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('../scripts/cloudinaryLegacy');
    return m.cloudinaryConfigured() ? m : null;
  } catch {
    return null;
  }
};

/** Можно ли прочитать файл (новые — из S3 KZ, старые — из Cloudinary до переноса) */
export const canReadStored = (p: StorageProvider): boolean =>
  isProviderAvailable(p) || (p === 'cloudinary' && !!legacy());

/** Старый документ без storageKey — только публичная ссылка Cloudinary (самые ранние загрузки) */
export const downloadLegacyUrl = async (url: string): Promise<Buffer> => {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !/(^|\.)cloudinary\.com$/.test(u.hostname)) throw new LegacyStorageError();
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Legacy download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

export const maxDocumentSize = (_p: StorageProvider): number => MAX_DOCUMENT_SIZE;

export type UploadTarget = { method: 'PUT'; url: string; headers: Record<string, string> };

/** Параметры прямой загрузки из браузера в закрытый бакет (одноразовая подписанная ссылка) */
export const prepareUpload = async (
  p: StorageProvider, key: string, mimeType: string, size: number
): Promise<UploadTarget> => {
  assertS3(p);
  return {
    method: 'PUT',
    url: await presignPrivateUpload(key, mimeType, size),
    headers: { 'Content-Type': mimeType },
  };
};

/** Размер загруженного файла (или ошибка, если файла нет) */
export const getStoredSize = async (p: StorageProvider, key: string): Promise<number> => {
  assertS3(p);
  return (await headPrivateObject(key)).size;
};

/** Ссылка для скачивания, действует 5 минут */
export const getDownloadUrl = async (
  p: StorageProvider, key: string, fileName: string, inline: boolean
): Promise<string> => {
  const old = p === 'cloudinary' ? legacy() : null;
  if (old) return old.cloudinaryDownloadUrl(key, inline);
  assertS3(p);
  return presignPrivateDownload(key, fileName, inline);
};

/** Первые байты файла — для проверки реального формата */
export const readStoredHead = async (p: StorageProvider, key: string, bytes = 16): Promise<Buffer> => {
  assertS3(p);
  return readPrivateHead(key, bytes);
};

/** Скачать файл целиком на сервер (внутренним запросом к S3, без публичной ссылки) */
export const downloadStored = async (p: StorageProvider, key: string): Promise<Buffer> => {
  const old = p === 'cloudinary' ? legacy() : null;
  if (old) return old.downloadFromCloudinary(key);
  assertS3(p);
  return getPrivateObject(key);
};

export const removeStored = async (p: StorageProvider, key: string): Promise<void> => {
  assertS3(p);
  await deletePrivateObject(key);
};
