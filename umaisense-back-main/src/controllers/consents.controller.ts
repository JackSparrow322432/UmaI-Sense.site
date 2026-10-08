import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../types';
import Consent, { CONSENT_TYPES, ConsentType, OPTIONAL_CONSENTS } from '../models/Consent';
import Child from '../models/Child';
import { CONSENT_VERSION, recordConsent, missingRequiredConsents, hasActiveConsent } from '../utils/consent';

/**
 * Согласия пользователя: просмотр, повторное подтверждение после обновления Политики,
 * выдача и отзыв необязательных согласий (трансграничная передача, ИИ-скрининг).
 */

// GET /api/consents — мои согласия + что требуется подтвердить
export const getMyConsents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [list, missing, crossBorder, aiScreening] = await Promise.all([
      Consent.find({ userId: req.user!.id })
        .sort({ createdAt: -1 })
        .select('type version childId createdAt withdrawnAt')
        .populate('childId', 'name lastName')
        .lean(),
      // админу политика не навязывается — он не субъект данных в сервисе
      req.user!.role === 'admin' ? Promise.resolve([]) : missingRequiredConsents(req.user!.id),
      hasActiveConsent(req.user!.id, 'cross_border'),
      hasActiveConsent(req.user!.id, 'ai_screening'),
    ]);
    res.json({
      currentVersion: CONSENT_VERSION,
      missingRequired: missing,
      active: { cross_border: crossBorder, ai_screening: aiScreening },
      consents: list,
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/consents  body: { types: ConsentType[], childId? }
export const grantConsents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const raw: unknown[] = Array.isArray(req.body?.types) ? req.body.types : [];
    const types = [...new Set(raw.filter((t): t is ConsentType => CONSENT_TYPES.includes(t as ConsentType)))];
    if (!types.length) { res.status(400).json({ message: 'Не указаны согласия' }); return; }

    let childId: string | undefined;
    if (req.body?.childId !== undefined) {
      childId = String(req.body.childId);
      if (!Types.ObjectId.isValid(childId) || !(await Child.exists({ _id: childId, parentId: req.user!.id }))) {
        res.status(404).json({ message: 'Child not found' });
        return;
      }
    }
    // child_data даётся только при создании профиля ребёнка
    if (types.includes('child_data') && !childId) {
      res.status(400).json({ message: 'Согласие на данные ребёнка даётся в профиле ребёнка' });
      return;
    }

    for (const type of types) await recordConsent(req, { userId: req.user!.id, childId, type });
    res.status(201).json({ message: 'Согласие сохранено', version: CONSENT_VERSION });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/consents/withdraw  body: { type }
// Отзыв обязательных согласий означает прекращение обслуживания — это делается удалением
// аккаунта/профиля ребёнка или письмом оператору, поэтому здесь отзываются только необязательные.
export const withdrawConsent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const type = String(req.body?.type ?? '') as ConsentType;
    if (!OPTIONAL_CONSENTS.includes(type)) {
      res.status(400).json({
        message: 'Это согласие обязательно для работы сервиса. Чтобы отозвать его, удалите аккаунт или напишите оператору (контакт — в Политике).',
      });
      return;
    }
    const r = await Consent.updateMany(
      { userId: req.user!.id, type, withdrawnAt: { $exists: false } },
      { withdrawnAt: new Date() }
    );
    res.json({ message: 'Согласие отозвано', withdrawn: r.modifiedCount });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
