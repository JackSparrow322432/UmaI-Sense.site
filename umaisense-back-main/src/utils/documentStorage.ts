import { v2 as cloudinary } from 'cloudinary';
import {
  isS3Enabled, presignPrivateUpload, presignPrivateDownload, headPrivateObject,
  readPrivateHead, deletePrivateObject,
} from './storage';
import { MAX_DOCUMENT_SIZE } from './fileTypes';

/**
 * Где хранятся документы детей. Один интерфейс для двух хранилищ:
 *
 *  • 's3'          — S3-совместимое хранилище в РК (Yandex Cloud kz1 и др.). Основной вариант.
 *  • 'cloudinary'  — временный вариант, пока проект на Vercel. Файлы загружаются как
 *                    ЗАКРЫТЫЕ (type: authenticated): по обычной ссылке их не открыть,
 *                    только по подписанной ссылке на 5 минут, которую выдаёт API.
 *
 * Если заданы переменные S3_* — новые документы идут в S3, иначе в Cloudinary.
 * У каждого документа записано, где он лежит (storageProvider), поэтому после переезда
 * старые документы продолжают открываться, а скрипт migrate:files переносит их в S3.
 */

export type StorageProvider = 's3' | 'cloudinary';

const cloudinaryReady = (): boolean => {
  const ok =
    !!process.env.CLOUDINARY_CLOUD_NAME &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET;
  if (ok) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
      ...(process.env.CLOUDINARY_UPLOAD_PREFIX ? { upload_prefix: process.env.CLOUDINARY_UPLOAD_PREFIX } : {}),
    });
  }
  return ok;
};

/** Хранилище для НОВЫХ документов */
export const activeProvider = (): StorageProvider | null => {
  if (isS3Enabled()) return 's3';
  if (cloudinaryReady()) return 'cloudinary';
  return null;
};

export const isProviderAvailable = (p: StorageProvider): boolean =>
  p === 's3' ? isS3Enabled() : cloudinaryReady();

/** Максимальный размер документа. В Cloudinary он ограничен тарифом (бесплатный — 10 МБ). */
export const maxDocumentSize = (p: StorageProvider): number =>
  p === 's3'
    ? MAX_DOCUMENT_SIZE
    : Math.min(MAX_DOCUMENT_SIZE, (Number(process.env.CLOUDINARY_MAX_DOC_MB) || 10) * 1024 * 1024);

const URL_TTL_SECONDS = 5 * 60;
const CLD = { resource_type: 'raw' as const, type: 'authenticated' as const };

export type UploadTarget =
  | { method: 'PUT'; url: string; headers: Record<string, string> }
  | { method: 'POST'; url: string; fields: Record<string, string> };

/**
 * Параметры прямой загрузки из браузера (файл не проходит через сервер —
 * на Vercel тело запроса ограничено ~4,5 МБ).
 */
export const prepareUpload = async (
  p: StorageProvider, key: string, mimeType: string, size: number
): Promise<UploadTarget> => {
  if (p === 's3') {
    return {
      method: 'PUT',
      url: await presignPrivateUpload(key, mimeType, size),
      headers: { 'Content-Type': mimeType },
    };
  }
  cloudinaryReady();
  // Подписываем ровно эти параметры: изменить public_id или сделать файл публичным нельзя
  const params = {
    public_id: key,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'authenticated',
  };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET as string);
  return {
    method: 'POST',
    // api_url учитывает регион аккаунта (CLOUDINARY_UPLOAD_PREFIX), по умолчанию api.cloudinary.com
    url: cloudinary.utils.api_url('upload', { resource_type: 'raw' }),
    fields: { ...params, signature, api_key: process.env.CLOUDINARY_API_KEY as string },
  };
};

/** Размер загруженного файла (или ошибка, если файла нет) */
export const getStoredSize = async (p: StorageProvider, key: string): Promise<number> => {
  if (p === 's3') return (await headPrivateObject(key)).size;
  cloudinaryReady();
  const r = await cloudinary.api.resource(key, CLD);
  return Number(r.bytes) || 0;
};

/** Ссылка для скачивания, действует 5 минут */
export const getDownloadUrl = async (
  p: StorageProvider, key: string, fileName: string, inline: boolean
): Promise<string> => {
  if (p === 's3') return presignPrivateDownload(key, fileName, inline);
  cloudinaryReady();
  // У raw-файлов расширение входит в public_id, поэтому формат не передаём.
  // Cloudinary отдаёт закрытые файлы только на скачивание (attachment).
  return cloudinary.utils.private_download_url(key, '', {
    ...CLD,
    expires_at: Math.floor(Date.now() / 1000) + URL_TTL_SECONDS,
  });
};

/** Первые байты файла — для проверки реального формата */
export const readStoredHead = async (p: StorageProvider, key: string, bytes = 16): Promise<Buffer> => {
  if (p === 's3') return readPrivateHead(key, bytes);
  const url = await getDownloadUrl(p, key, 'file', false);
  const r = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!r.ok || !r.body) throw new Error(`Cloudinary download failed: ${r.status}`);
  // Если Range не поддержан — читаем только первый кусок и прерываем загрузку
  const reader = r.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (total < bytes) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    chunks.push(Buffer.from(value));
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).subarray(0, bytes);
};

/** Скачать файл целиком (для переноса из Cloudinary в S3) */
export const downloadStored = async (p: StorageProvider, key: string): Promise<Buffer> => {
  const url = await getDownloadUrl(p, key, 'file', false);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

export const removeStored = async (p: StorageProvider, key: string): Promise<void> => {
  if (p === 's3') {
    await deletePrivateObject(key);
    return;
  }
  cloudinaryReady();
  await cloudinary.uploader.destroy(key, { ...CLD, invalidate: true });
};
