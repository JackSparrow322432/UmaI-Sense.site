import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3-совместимое хранилище в Казахстане (Yandex Cloud kz1, Pro-Data, Servercore, MinIO…).
 *
 *  • S3_PRIVATE_BUCKET — медицинские и личные документы. Бакет ЗАКРЫТЫЙ: файл можно
 *    скачать только по одноразовой ссылке, которую API выдаёт после проверки прав.
 *  • S3_PUBLIC_BUCKET  — картинки интерфейса (фото профиля, обложки статей/заданий).
 *    Ключи — случайные UUID, их нельзя угадать.
 *
 * Переменные: S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 * S3_PRIVATE_BUCKET, S3_PUBLIC_BUCKET, S3_PUBLIC_URL, S3_FORCE_PATH_STYLE.
 *
 * S3_PUBLIC_ENDPOINT — адрес хранилища, доступный из браузера (например https://s3.umaisense.kz),
 * если сервер ходит в S3 по внутренней сети (S3_ENDPOINT=http://10.10.0.11:3900).
 * Одноразовые ссылки подписываются на него: браузер не видит внутренние адреса.
 */

let client: S3Client | null = null;
let presignClient: S3Client | null = null;

export const isS3Enabled = (): boolean =>
  !!process.env.S3_ENDPOINT &&
  !!process.env.S3_ACCESS_KEY_ID &&
  !!process.env.S3_SECRET_ACCESS_KEY &&
  !!process.env.S3_PRIVATE_BUCKET;

export const isPublicS3Enabled = (): boolean =>
  isS3Enabled() && !!process.env.S3_PUBLIC_BUCKET && !!process.env.S3_PUBLIC_URL;

const makeClient = (endpoint: string | undefined) =>
    new S3Client({
      endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      // Новые версии AWS SDK по умолчанию добавляют в подписанную ссылку контрольную сумму
      // ПУСТОГО тела (x-amz-checksum-crc32=AAAAAA==) — S3-совместимые хранилища (MinIO, Garage,
      // Ceph и др.) отклоняют такую загрузку. Считаем суммы только там, где это обязательно.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      },
    });

/** Клиент для операций сервера (внутренняя сеть) */
const s3 = (): S3Client => (client ??= makeClient(process.env.S3_ENDPOINT));

/** Клиент для подписи ссылок, которые откроет браузер (публичный адрес хранилища) */
const s3ForBrowser = (): S3Client =>
  (presignClient ??= makeClient(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT));

const privateBucket = () => process.env.S3_PRIVATE_BUCKET as string;
const publicBucket = () => process.env.S3_PUBLIC_BUCKET as string;

/** Ссылки живут 5 минут — достаточно, чтобы открыть файл, но бесполезно пересылать */
const URL_TTL_SECONDS = 5 * 60;

/** Одноразовая ссылка для загрузки файла браузером напрямую в закрытый бакет */
export const presignPrivateUpload = (key: string, contentType: string, size: number) =>
  getSignedUrl(
    s3ForBrowser(),
    new PutObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: size, // подписывается — загрузить файл другого размера не получится
    }),
    { expiresIn: URL_TTL_SECONDS }
  );

const contentDisposition = (fileName: string, inline: boolean) => {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

/** Одноразовая ссылка для просмотра/скачивания файла из закрытого бакета */
export const presignPrivateDownload = (key: string, fileName: string, inline: boolean) =>
  getSignedUrl(
    s3ForBrowser(),
    new GetObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      ResponseContentDisposition: contentDisposition(fileName, inline),
    }),
    { expiresIn: URL_TTL_SECONDS }
  );

export const headPrivateObject = async (key: string) => {
  const r = await s3().send(new HeadObjectCommand({ Bucket: privateBucket(), Key: key }));
  return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? '' };
};

/** Первые байты файла — для проверки реального формата (сигнатуры) */
export const readPrivateHead = async (key: string, bytes = 16): Promise<Buffer> => {
  const r = await s3().send(new GetObjectCommand({ Bucket: privateBucket(), Key: key, Range: `bytes=0-${bytes - 1}` }));
  const chunks: Buffer[] = [];
  for await (const chunk of r.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).subarray(0, bytes);
};

export const deletePrivateObject = (key: string) =>
  s3().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }));

export const putPrivateObject = (key: string, body: Buffer, contentType: string) =>
  s3().send(new PutObjectCommand({ Bucket: privateBucket(), Key: key, Body: body, ContentType: contentType }));

/** Загрузка картинки в публичный бакет; возвращает постоянный URL */
export const putPublicObject = async (key: string, body: Buffer, contentType: string): Promise<string> => {
  await s3().send(new PutObjectCommand({
    Bucket: publicBucket(), Key: key, Body: body, ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${(process.env.S3_PUBLIC_URL as string).replace(/\/+$/, '')}/${key}`;
};
