import { Schema, model, Types, Document } from 'mongoose';

/**
 * Журнал доступа к персональным и медицинским данным: кто, когда и с какого IP
 * открыл документ или профиль ребёнка. Нужен для расследования инцидентов
 * (уведомление о утечке — в течение одного рабочего дня) и ответов на запросы родителей.
 */
export type AuditAction =
  | 'document.upload' | 'document.view' | 'document.delete'
  | 'child.view' | 'child.access_granted'
  | 'admin.grant' | 'admin.revoke';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  role?: string;
  action: AuditAction;
  childId?: Types.ObjectId;
  documentId?: Types.ObjectId;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS) || 3 * 365;

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String },
    action: { type: String, required: true },
    childId: { type: Schema.Types.ObjectId, ref: 'Child' },
    documentId: { type: Schema.Types.ObjectId },
    ip: { type: String },
    userAgent: { type: String },
    meta: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: RETENTION_DAYS * 24 * 3600 },
  },
  { versionKey: false }
);

auditLogSchema.index({ childId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

export default model<IAuditLog>('AuditLog', auditLogSchema);
