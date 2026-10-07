import { Schema, model } from 'mongoose';
import { IDocument } from '../types';

const documentSchema = new Schema<IDocument>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Ключ файла в закрытом S3-бакете (новые документы)
    storageKey: { type: String },
    // Где лежит файл: 's3' (хранилище в РК) или 'cloudinary' (временно, закрытые файлы)
    storageProvider: { type: String, enum: ['s3', 'cloudinary'] },
    // Старые документы до переезда (Cloudinary). Скрипт migrate:files переносит их в S3.
    fileUrl: { type: String },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number },
    status: { type: String, enum: ['uploading', 'ready'], default: 'ready' },
    // Срок незавершённой загрузки: после него запись и файл удаляет sweepAbandonedUploads()
    // (не TTL-индекс: он удалил бы только запись, а файл остался бы в хранилище без владельца)
    uploadExpiresAt: { type: Date, index: true },
    // ИИ-разбор документов отключён: медицинские документы не передаются за рубеж
    aiStatus: { type: String, enum: ['pending', 'done', 'failed', 'disabled'], default: 'disabled' },
    aiExplanation: { type: String },
  },
  { timestamps: true }
);

export default model<IDocument>('Document', documentSchema);
