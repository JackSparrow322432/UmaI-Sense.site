import { Request } from 'express';
import { Types } from 'mongoose';
import Consent, { ConsentType } from '../models/Consent';

/**
 * Текущая редакция текстов согласия. При любом изменении текста на страницах /privacy и /agreement
 * поднимайте версию — новые согласия будут записываться с ней, а пользователи без согласия
 * текущей редакции увидят окно с просьбой подтвердить обновлённую политику.
 */
export const CONSENT_VERSION = process.env.CONSENT_VERSION || '2026-10-08';

/** Согласия, без которых аккаунтом пользоваться нельзя (проверяются на текущую версию) */
export const REQUIRED_ACCOUNT_CONSENTS: ConsentType[] = ['account', 'third_party_transfer'];

export const recordConsent = async (
  req: Request,
  data: { userId: string | Types.ObjectId; childId?: string | Types.ObjectId; type: ConsentType }
): Promise<void> => {
  await Consent.create({
    ...data,
    version: CONSENT_VERSION,
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
  });
};

/** Есть ли действующее (не отозванное) согласие данного типа — любой редакции */
export const hasActiveConsent = async (
  userId: string | Types.ObjectId,
  type: ConsentType,
  childId?: string | Types.ObjectId
): Promise<boolean> => {
  const filter: Record<string, unknown> = { userId, type, withdrawnAt: { $exists: false } };
  if (childId) filter.childId = childId;
  return !!(await Consent.exists(filter));
};

/** Каких обязательных согласий ТЕКУЩЕЙ редакции не хватает пользователю */
export const missingRequiredConsents = async (userId: string | Types.ObjectId): Promise<ConsentType[]> => {
  const have = await Consent.find({
    userId,
    type: { $in: REQUIRED_ACCOUNT_CONSENTS },
    version: CONSENT_VERSION,
    withdrawnAt: { $exists: false },
  }).distinct('type');
  return REQUIRED_ACCOUNT_CONSENTS.filter((t) => !have.includes(t));
};
