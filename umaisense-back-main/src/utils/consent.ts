import { Request } from 'express';
import { Types } from 'mongoose';
import Consent from '../models/Consent';

/**
 * Текущая редакция текстов согласия. При любом изменении текста на странице /privacy
 * поднимайте версию — новые согласия будут записываться с ней.
 */
export const CONSENT_VERSION = process.env.CONSENT_VERSION || '2026-10-07';

export const recordConsent = async (
  req: Request,
  data: { userId: string | Types.ObjectId; childId?: string | Types.ObjectId; type: 'account' | 'child_data' }
): Promise<void> => {
  await Consent.create({
    ...data,
    version: CONSENT_VERSION,
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
  });
};
