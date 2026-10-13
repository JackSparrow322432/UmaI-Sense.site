/**
 * Доступ к СТАРЫМ файлам в Cloudinary: одноразовый перенос в Yandex Object Storage KZ
 * (scripts/migrate-files-to-s3.ts) и чтение старых документов до переноса (utils/documentStorage.ts).
 * Новые файлы в Cloudinary не загружаются.
 * Пакет `cloudinary` установлен как devDependency и в production-образ не попадает.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = (): any => require('cloudinary').v2;

const CLD = { resource_type: 'raw' as const, type: 'authenticated' as const };

export const cloudinaryConfigured = (): boolean =>
  !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET;

const client = () => {
  const c = load();
  c.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
    ...(process.env.CLOUDINARY_UPLOAD_PREFIX ? { upload_prefix: process.env.CLOUDINARY_UPLOAD_PREFIX } : {}),
  });
  return c;
};

/** Скачать закрытый документ из Cloudinary целиком */
export const downloadFromCloudinary = async (key: string): Promise<Buffer> => {
  const url = client().utils.private_download_url(key, '', { ...CLD, expires_at: Math.floor(Date.now() / 1000) + 300 });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Cloudinary download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

export const removeFromCloudinary = async (key: string): Promise<void> => {
  await client().uploader.destroy(key, { ...CLD, invalidate: true });
};

/** Ссылка на старый документ на 5 минут (просмотр или скачивание) */
export const cloudinaryDownloadUrl = (key: string, inline: boolean): string =>
  client().utils.private_download_url(key, '', { ...CLD, attachment: !inline, expires_at: Math.floor(Date.now() / 1000) + 300 });
