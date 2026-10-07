import { Types } from 'mongoose';
import AuditLog, { AuditAction } from '../models/AuditLog';
import { AuthRequest } from '../types';

type Id = string | Types.ObjectId;

/** Запись в журнал доступа. Никогда не роняет основной запрос. */
export const logAccess = async (
  req: AuthRequest,
  entry: { action: AuditAction; childId?: Id; documentId?: Id; meta?: Record<string, unknown> }
): Promise<void> => {
  try {
    await AuditLog.create({
      ...entry,
      userId: req.user?.id,
      role: req.user?.role,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    });
  } catch (err) {
    console.error('[audit] write failed:', err);
  }
};
