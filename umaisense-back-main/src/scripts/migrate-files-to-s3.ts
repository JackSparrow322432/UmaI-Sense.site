/**
 * Перенос файлов из Cloudinary / локальной папки uploads в S3-хранилище в Казахстане.
 *
 *   npm run migrate:files -- --dry-run     # только показать, что будет перенесено
 *   npm run migrate:files                  # перенести
 *
 * Что переносится:
 *   • документы (Document.fileUrl)          → ЗАКРЫТЫЙ бакет, ссылка в базе заменяется на storageKey
 *   • закрытые документы в Cloudinary       → ЗАКРЫТЫЙ бакет (storageProvider меняется на 's3')
 *   • фото детей и пользователей, обложки статей/заданий, фото выполненных заданий,
 *     вложения дневника                      → публичный бакет, URL в базе заменяется
 *
 * Скрипт идемпотентный: уже перенесённое пропускается, его можно запускать повторно.
 * После успешного переноса удалите файлы в Cloudinary вручную (в консоли Cloudinary).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import DocumentModel from '../models/Document';
import Child from '../models/Child';
import User from '../models/User';
import Article from '../models/Article';
import Task from '../models/Task';
import TaskRating from '../models/TaskRating';
import DiaryEntry from '../models/DiaryEntry';
import { isS3Enabled, isPublicS3Enabled, putPrivateObject, putPublicObject } from '../utils/storage';
import { DOCUMENT_TYPES, IMAGE_TYPES, extFor, matchesSignature } from '../utils/fileTypes';
import { downloadStored, removeStored, isProviderAvailable } from '../utils/documentStorage';

const DRY = process.argv.includes('--dry-run');
const PUBLIC_PREFIX = (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, '');
const stats = { documents: 0, images: 0, skipped: 0, failed: 0 };

const isForeign = (url?: string | null): url is string =>
  !!url && (url.includes('res.cloudinary.com') || url.startsWith('/uploads/')) && !(PUBLIC_PREFIX && url.startsWith(PUBLIC_PREFIX));

const fetchFile = async (url: string): Promise<{ buffer: Buffer; contentType: string }> => {
  if (url.startsWith('/uploads/')) {
    const file = path.join(__dirname, '../..', url);
    const ext = path.extname(file).slice(1).toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return { buffer: fs.readFileSync(file), contentType };
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { buffer: Buffer.from(await r.arrayBuffer()), contentType: (r.headers.get('content-type') || '').split(';')[0] };
};

// Реальный формат определяем по первым байтам; неизвестный (HEIC, AVIF…) сохраняем как есть
const detectImage = (buffer: Buffer, fallback: string): { type: string; ext: string } => {
  const head = buffer.subarray(0, 16);
  for (const t of Object.keys(IMAGE_TYPES)) {
    if (matchesSignature(IMAGE_TYPES, t, head)) return { type: t, ext: extFor(IMAGE_TYPES, t) };
  }
  const ext = (fallback.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  return { type: fallback || 'application/octet-stream', ext };
};

const moveImage = async (url: string): Promise<string> => {
  const { buffer, contentType } = await fetchFile(url);
  const { type, ext } = detectImage(buffer, contentType);
  const key = `images/migrated/${randomUUID()}.${ext}`;
  stats.images++;
  return putPublicObject(key, buffer, type);
};

const migrateImageField = async (model: mongoose.Model<any>, field: string, label: string) => {
  const docs = await model.find({ [field]: { $regex: '(res\\.cloudinary\\.com|^/uploads/)' } }).select(field);
  for (const d of docs) {
    const url = d.get(field) as string;
    if (!isForeign(url)) { stats.skipped++; continue; }
    console.log(`${label} ${d._id}: ${url}`);
    if (DRY) continue;
    try {
      d.set(field, await moveImage(url));
      await d.save();
    } catch (err) {
      stats.failed++;
      console.error(`  ✗ ${label} ${d._id}:`, (err as Error).message);
    }
  }
};

const main = async () => {
  if (!isS3Enabled() || !isPublicS3Enabled()) {
    throw new Error('Задайте S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PRIVATE_BUCKET, S3_PUBLIC_BUCKET, S3_PUBLIC_URL');
  }
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log(DRY ? '— DRY RUN: ничего не меняется —' : '— Перенос файлов —');

  // 1. Документы → закрытый бакет
  const documents = await DocumentModel.find({ storageKey: { $exists: false }, fileUrl: { $exists: true } });
  for (const doc of documents) {
    console.log(`document ${doc._id}: ${doc.fileUrl}`);
    if (DRY) continue;
    try {
      const { buffer, contentType } = await fetchFile(doc.fileUrl as string);
      const head = buffer.subarray(0, 16);
      const mime =
        Object.keys(DOCUMENT_TYPES).find((t) => matchesSignature(DOCUMENT_TYPES, t, head)) ||
        (DOCUMENT_TYPES[doc.mimeType] ? doc.mimeType : contentType || 'application/octet-stream');
      const key = `documents/${doc.childId}/${randomUUID()}.${DOCUMENT_TYPES[mime] ? extFor(DOCUMENT_TYPES, mime) : 'bin'}`;
      await putPrivateObject(key, buffer, mime);
      doc.storageKey = key;
      doc.storageProvider = 's3';
      doc.size = buffer.length;
      doc.mimeType = mime;
      doc.status = 'ready';
      doc.fileUrl = undefined; // публичной ссылки на медицинский документ больше нет
      await doc.save();
      stats.documents++;
    } catch (err) {
      stats.failed++;
      console.error(`  ✗ document ${doc._id}:`, (err as Error).message);
    }
  }

  // 1б. Закрытые документы из Cloudinary (загруженные, пока проект был на Vercel)
  const cldDocs = await DocumentModel.find({ storageProvider: 'cloudinary', status: 'ready' });
  if (cldDocs.length && !isProviderAvailable('cloudinary')) {
    console.error('Есть документы в Cloudinary, но не заданы CLOUDINARY_* — пропускаю их');
  } else {
    for (const doc of cldDocs) {
      console.log(`cloudinary document ${doc._id}: ${doc.storageKey}`);
      if (DRY) continue;
      try {
        const oldKey = doc.storageKey as string;
        const buffer = await downloadStored('cloudinary', oldKey);
        const key = `documents/${doc.childId}/${randomUUID()}.${extFor(DOCUMENT_TYPES, doc.mimeType)}`;
        await putPrivateObject(key, buffer, doc.mimeType);
        doc.storageKey = key;
        doc.storageProvider = 's3';
        doc.size = buffer.length;
        await doc.save();
        await removeStored('cloudinary', oldKey).catch(() => {});
        stats.documents++;
      } catch (err) {
        stats.failed++;
        console.error(`  ✗ document ${doc._id}:`, (err as Error).message);
      }
    }
  }

  // 2. Картинки → публичный бакет
  await migrateImageField(Child, 'photo', 'child.photo');
  await migrateImageField(User, 'photo', 'user.photo');
  await migrateImageField(Article, 'coverImage', 'article.cover');
  await migrateImageField(Task, 'coverImage', 'task.cover');
  await migrateImageField(TaskRating, 'submissionUrl', 'task.submission');

  // 3. Вложения дневника (массив)
  const entries = await DiaryEntry.find({ media: { $regex: '(res\\.cloudinary\\.com|^/uploads/)' } });
  for (const e of entries) {
    const media = (e.media ?? []) as string[];
    console.log(`diary ${e._id}: ${media.filter(isForeign).length} file(s)`);
    if (DRY) continue;
    try {
      e.media = await Promise.all(media.map((m) => (isForeign(m) ? moveImage(m) : m)));
      await e.save();
    } catch (err) {
      stats.failed++;
      console.error(`  ✗ diary ${e._id}:`, (err as Error).message);
    }
  }

  console.log('Готово:', stats);
  await mongoose.disconnect();
  if (stats.failed > 0) process.exitCode = 1;
};

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
