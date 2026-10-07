import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../types';
import Child from '../models/Child';
import DocumentModel from '../models/Document';
import {
  activeProvider, isProviderAvailable, maxDocumentSize, prepareUpload, getStoredSize,
  getDownloadUrl as storageDownloadUrl, readStoredHead, removeStored, StorageProvider,
} from '../utils/documentStorage';
import { DOCUMENT_TYPES, matchesSignature, extFor, cleanFileName } from '../utils/fileTypes';
import { logAccess } from '../utils/audit';

/**
 * Медицинские и личные документы ребёнка.
 *
 * Файлы хранятся в ЗАКРЫТОМ хранилище: S3 в Казахстане, а пока проект на Vercel —
 * закрытые файлы Cloudinary (см. utils/documentStorage.ts). Браузер загружает файл напрямую
 * в хранилище по одноразовой подписи (сервер не пропускает через себя файл), а скачать
 * его можно только по ссылке на 5 минут, которую API выдаёт после проверки прав.
 * Каждое открытие документа записывается в журнал доступа.
 *
 * ИИ-разбор документов отключён: медицинские документы не передаются за рубеж.
 */

const UPLOAD_WINDOW_MS = 30 * 60 * 1000; // незавершённая загрузка удаляется через 30 минут

// Доступ: родитель или прикреплённый тренер (как в children.controller)
const getChildWithAccess = async (childId: string, userId?: string) => {
  const child = await Child.findById(childId);
  if (!child) return null;
  const hasAccess =
    child.parentId.toString() === userId ||
    child.trainers.some((t) => t.toString() === userId);
  return hasAccess ? child : null;
};

// Старые документы (до появления поля) лежат в S3, если у них есть storageKey
const providerOf = (doc: { storageProvider?: string }): StorageProvider =>
  doc.storageProvider === 'cloudinary' ? 'cloudinary' : 's3';

const storageUnavailable = (res: Response) =>
  res.status(503).json({ message: 'Хранилище документов не настроено. Обратитесь к администратору.' });

// Наружу не отдаём ключ хранилища
const PUBLIC_FIELDS = '-storageKey -storageProvider -uploadExpiresAt';

/**
 * Удаляет незавершённые загрузки (файл мог дойти до хранилища, а /complete — нет).
 * Запускается по таймеру в index.ts и заодно при каждой новой загрузке.
 */
export const sweepAbandonedUploads = async (limit = 100): Promise<number> => {
  const stale = await DocumentModel.find({ status: 'uploading', uploadExpiresAt: { $lt: new Date() } })
    .limit(limit)
    .select('storageKey storageProvider');
  for (const d of stale) {
    const p = providerOf(d);
    if (d.storageKey && isProviderAvailable(p)) await removeStored(p, d.storageKey).catch(() => {});
    await d.deleteOne();
  }
  return stale.length;
};

// ─── GET /api/documents/:childId ───────────────────────────────────────────────

export const listDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    const documents = await DocumentModel.find({ childId: child._id, status: { $ne: 'uploading' } })
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name role');
    res.json(documents);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// ─── POST /api/documents/:childId/upload-url  { fileName, mimeType, size } ─────
// Шаг 1: проверяем тип и размер, создаём запись и выдаём одноразовую ссылку на загрузку.

export const createUploadUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = activeProvider();
    if (!provider) { storageUnavailable(res); return; }

    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }

    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : '';
    const size = Number(req.body?.size);
    const fileName = cleanFileName(req.body?.fileName);

    if (!DOCUMENT_TYPES[mimeType]) {
      res.status(400).json({ message: 'Можно загружать PDF, Word (DOC, DOCX) или фото (JPG, PNG, HEIC)' });
      return;
    }
    if (!Number.isInteger(size) || size <= 0) {
      res.status(400).json({ message: 'Пустой файл' });
      return;
    }
    const maxSize = maxDocumentSize(provider);
    if (size > maxSize) {
      res.status(400).json({ message: `Файл больше ${Math.round(maxSize / 1024 / 1024)} МБ` });
      return;
    }

    void sweepAbandonedUploads(20).catch(() => {});

    const storageKey = `documents/${child._id}/${randomUUID()}.${extFor(DOCUMENT_TYPES, mimeType)}`;
    const document = await DocumentModel.create({
      childId: child._id,
      uploadedBy: req.user?.id,
      storageKey,
      storageProvider: provider,
      fileName,
      mimeType,
      size,
      status: 'uploading',
      uploadExpiresAt: new Date(Date.now() + UPLOAD_WINDOW_MS),
      aiStatus: 'disabled',
    });

    const target = await prepareUpload(provider, storageKey, mimeType, size);
    res.status(201).json({ documentId: document._id, ...target });
  } catch (err) {
    console.error('[Documents] upload-url error:', err);
    res.status(500).json({ message: 'Ошибка подготовки загрузки' });
  }
};

// ─── POST /api/documents/:childId/:documentId/complete ─────────────────────────
// Шаг 2: файл загружен — проверяем, что он реально есть, нужного размера и формата.

export const completeUpload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    const document = await DocumentModel.findOne({
      _id: req.params['documentId'], childId: child._id, uploadedBy: req.user?.id, status: 'uploading',
    });
    if (!document || !document.storageKey) {
      res.status(404).json({ message: 'Загрузка не найдена или устарела' });
      return;
    }

    const provider = providerOf(document);
    if (!isProviderAvailable(provider)) { storageUnavailable(res); return; }

    const reject = async (message: string) => {
      await removeStored(provider, document.storageKey as string).catch(() => {});
      await document.deleteOne();
      res.status(400).json({ message });
    };

    let storedSize: number;
    try {
      storedSize = await getStoredSize(provider, document.storageKey);
    } catch {
      res.status(400).json({ message: 'Файл не загрузился в хранилище. Попробуйте ещё раз.' });
      return;
    }
    if (storedSize !== document.size || storedSize > maxDocumentSize(provider)) {
      await reject('Размер файла не совпадает с заявленным');
      return;
    }
    const firstBytes = await readStoredHead(provider, document.storageKey);
    if (!matchesSignature(DOCUMENT_TYPES, document.mimeType, firstBytes)) {
      await reject('Содержимое файла не соответствует формату (PDF, Word или фото)');
      return;
    }

    document.status = 'ready';
    document.uploadExpiresAt = undefined;
    await document.save();
    await logAccess(req, { action: 'document.upload', childId: child._id, documentId: document._id });

    const saved = await DocumentModel.findById(document._id).select(PUBLIC_FIELDS).populate('uploadedBy', 'name role');
    res.json(saved);
  } catch (err) {
    console.error('[Documents] complete error:', err);
    res.status(500).json({ message: 'Ошибка сохранения документа' });
  }
};

// ─── GET /api/documents/:childId/:documentId/download?inline=1 ─────────────────
// Одноразовая ссылка на 5 минут. Каждый просмотр пишется в журнал доступа.

export const getDownloadUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    const document = await DocumentModel.findOne({ _id: req.params['documentId'], childId: child._id, status: { $ne: 'uploading' } });
    if (!document) {
      res.status(404).json({ message: 'Документ не найден' });
      return;
    }

    let url: string;
    if (document.storageKey) {
      const provider = providerOf(document);
      if (!isProviderAvailable(provider)) { storageUnavailable(res); return; }
      url = await storageDownloadUrl(provider, document.storageKey, document.fileName, req.query['inline'] === '1');
    } else if (document.fileUrl) {
      // Старый документ, ещё не перенесённый скриптом migrate:files
      url = document.fileUrl;
    } else {
      res.status(404).json({ message: 'Файл документа не найден' });
      return;
    }

    await logAccess(req, { action: 'document.view', childId: child._id, documentId: document._id });
    res.json({ url, expiresIn: 300 });
  } catch (err) {
    console.error('[Documents] download error:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// ─── DELETE /api/documents/:childId/:documentId ────────────────────────────────

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    const document = await DocumentModel.findOne({ _id: req.params['documentId'], childId: child._id });
    if (!document) {
      res.status(404).json({ message: 'Документ не найден' });
      return;
    }
    const isOwner = document.uploadedBy.toString() === req.user?.id;
    const isParent = child.parentId.toString() === req.user?.id;
    if (!isOwner && !isParent) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    if (document.storageKey) {
      const provider = providerOf(document);
      if (isProviderAvailable(provider)) await removeStored(provider, document.storageKey);
    }
    await document.deleteOne();
    await logAccess(req, { action: 'document.delete', childId: child._id, documentId: document._id, meta: { fileName: document.fileName } });
    res.json({ message: 'Документ удалён' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
