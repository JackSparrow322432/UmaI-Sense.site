import { Response } from 'express';
import { AuthRequest } from '../types';
import Child from '../models/Child';
import { Types } from 'mongoose';
import { isValidIin } from '../utils/iin';
import EnrollmentRequest from '../models/EnrollmentRequest';
import Assignment from '../models/Assignment';
import Session from '../models/Session';
import { todayStr } from '../utils/schedule';
import { recordConsent } from '../utils/consent';
import { logAccess } from '../utils/audit';
import AuditLog from '../models/AuditLog';
import { purgeChildData } from '../utils/purgeChild';

/**
 * Проверка полей, обязательных для записи на занятия.
 * partial = true — проверяем только присланные поля (для PUT).
 */
const validateChildPayload = (body: any, partial: boolean): string | null => {
  if (!partial || body.lastName !== undefined) {
    if (typeof body.lastName !== 'string' || !body.lastName.trim()) return 'Укажите фамилию ребёнка';
  }
  if (!partial || body.iin !== undefined) {
    if (!isValidIin(body.iin)) return 'Некорректный ИИН (12 цифр)';
  }
  if (!partial || body.adaptiveSkating !== undefined) {
    const a = body.adaptiveSkating;
    if (!a || typeof a.hasExperience !== 'boolean') {
      return 'Укажите, был ли ребёнок ранее на адаптивном катании';
    }
    if (a.hasExperience) {
      if (typeof a.when !== 'string' || !a.when.trim()) return 'Укажите, когда ребёнок занимался адаптивным катанием';
      if (typeof a.details !== 'string' || !a.details.trim()) return 'Опишите подробности занятий адаптивным катанием';
    }
  }
  return null;
};

/**
 * Поля, которые родитель может задавать сам. Всё остальное (parentId, trainers,
 * а также Mongo-операторы вроде $set/$addToSet) отбрасывается — иначе через PUT
 * можно было бы подключить к ребёнку любого тренера в обход администратора.
 */
const EDITABLE_FIELDS = [
  'name', 'lastName', 'iin', 'dateOfBirth', 'photo', 'diagnosis', 'communicationMethod',
  'fears', 'triggers', 'interests', 'calmingActivities', 'sensoryProfile', 'behavioralNotes',
  'goals', 'adaptiveSkating',
] as const;

const pickEditable = (body: any): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object') return out;
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};

const sanitizeSkating = (a: any) =>
  a
    ? {
        hasExperience: a.hasExperience,
        when: a.hasExperience ? String(a.when).trim() : undefined,
        details: a.hasExperience ? String(a.details).trim() : undefined,
      }
    : undefined;

// GET /api/children
export const getChildren = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new Types.ObjectId(req.user?.id);
    const query =
      req.user?.role === 'parent'
        ? { parentId: userId }
        : { trainers: userId };

    const children = await Child.find(query).populate('trainers', 'name phone photo');
    res.json(children);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/children/:id
export const getChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findById(req.params.id).populate('trainers', 'name phone photo');
    if (!child) {
      res.status(404).json({ message: 'Child not found' });
      return;
    }
    const userId = req.user?.id;
    const hasAccess =
      child.parentId.toString() === userId ||
      child.trainers.some((t: any) => t._id.toString() === userId);

    if (!hasAccess) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    // Чужие просмотры профиля (с ИИН и медицинскими данными) пишем в журнал доступа
    if (child.parentId.toString() !== userId) {
      await logAccess(req, { action: 'child.view', childId: child._id });
    }
    // Тренеры, записанные администратором: родитель не может их откреплять сам
    const managedTrainerIds = (
      await Assignment.find({ childId: child._id, status: 'active' }).distinct('trainerId')
    ).map(String);
    res.json({ ...child.toObject(), managedTrainerIds });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/children
export const createChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const error = validateChildPayload(req.body, false);
    if (error) {
      res.status(400).json({ message: error });
      return;
    }
    // Родитель как законный представитель даёт согласие на обработку данных ребёнка,
    // в том числе сведений о здоровье (диагноз, медицинские документы)
    if (req.body?.consent !== true) {
      res.status(400).json({ message: 'Необходимо согласие законного представителя на обработку данных ребёнка' });
      return;
    }
    const body = pickEditable(req.body) as any;
    const child = await Child.create({
      ...body,
      lastName: body.lastName.trim(),
      adaptiveSkating: sanitizeSkating(body.adaptiveSkating),
      parentId: req.user?.id,
      trainers: [],
    });
    await recordConsent(req, { userId: req.user?.id as string, childId: child._id, type: 'child_data' });
    res.status(201).json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/children/:id
export const updateChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const error = validateChildPayload(req.body, true);
    if (error) {
      res.status(400).json({ message: error });
      return;
    }
    // Только разрешённые поля и только через $set: родитель не может менять владельца,
    // список тренеров (их назначает администратор) или подсовывать Mongo-операторы
    const body = pickEditable(req.body) as any;
    if (body.adaptiveSkating !== undefined) body.adaptiveSkating = sanitizeSkating(body.adaptiveSkating);
    if (typeof body.lastName === 'string') body.lastName = body.lastName.trim();
    const child = await Child.findOneAndUpdate(
      { _id: req.params.id, parentId: req.user?.id },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    res.json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/children/:id
export const deleteChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findOne({ _id: req.params.id, parentId: req.user?.id }).select('_id');
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    // Удаляем документы (вместе с файлами), наблюдения и прогресс; отменяем занятия
    await purgeChildData(child._id);
    res.json({ message: 'Child deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/children/:id/trainers/:trainerId
export const removeTrainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Тренера, записанного администратором, может открепить только администратор (иначе
    // занятия в календаре остались бы, а доступа у тренера не было бы)
    const trainerId = req.params['trainerId'] as string;
    if (Types.ObjectId.isValid(trainerId)) {
      const managed = await Assignment.exists({
        childId: req.params.id, trainerId, status: 'active',
      });
      if (managed) {
        res.status(409).json({ message: 'Тренер записан администратором — для отмены обратитесь к администратору' });
        return;
      }
    }
    const child = await Child.findOneAndUpdate(
      { _id: req.params.id, parentId: req.user?.id },
      { $pull: { trainers: new Types.ObjectId(req.params['trainerId'] as string) } },
      { new: true }
    );
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    res.json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/children/:id/access-log — родитель видит, кто открывал профиль и документы ребёнка
export const getAccessLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findOne({ _id: req.params.id, parentId: req.user?.id }).select('_id');
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    const entries = await AuditLog.find({ childId: child._id })
      .populate('userId', 'name role')
      .select('-ip -userAgent')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(entries);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
