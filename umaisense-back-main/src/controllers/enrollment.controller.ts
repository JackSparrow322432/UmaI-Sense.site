import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest, Weekday } from '../types';
import Child from '../models/Child';
import User from '../models/User';
import EnrollmentRequest from '../models/EnrollmentRequest';
import Assignment from '../models/Assignment';
import Session from '../models/Session';
import Notification from '../models/Notification';
import InviteCode from '../models/InviteCode';
import { generateInviteCode } from '../utils/generateToken';
import { sendNotificationEmail, escapeHtml } from '../utils/sendEmail';
import { logAccess } from '../utils/audit';
import { isValidIin } from '../utils/iin';
import {
  TIME_RE, todayStr, isoWeekday, addDays, isValidDate, addMinutes, formatSlots, formatDateRu,
} from '../utils/schedule';

const MAX_PERIOD_DAYS = 366;

const childFullName = (c: any) => [c?.name, c?.lastName].filter(Boolean).join(' ');

const isObjectId = (v: unknown): v is string => typeof v === 'string' && Types.ObjectId.isValid(v);

const parseWeekdays = (v: unknown): Weekday[] | null => {
  if (!Array.isArray(v) || v.length === 0) return null;
  const days = [...new Set(v.map(Number))];
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return null;
  return days.sort() as Weekday[];
};

const generateUniqueCode = async (): Promise<string> => {
  for (let i = 0; i < 20; i++) {
    const code = generateInviteCode();
    const [a, b] = await Promise.all([
      Assignment.exists({ accessCode: code }),
      InviteCode.exists({ code }),
    ]);
    if (!a && !b) return code;
  }
  throw new Error('Could not generate unique access code');
};

/**
 * Убираем тренера из child.trainers после отмены записи, если у него не осталось активных
 * закреплений на этого ребёнка. Если доступ у тренера был ещё до этой записи
 * (старый код от родителя) — его не трогаем.
 */
const detachTrainerIfUnused = async (assignment: any) => {
  if (assignment.hadAccessBefore) return;
  const { childId, trainerId } = assignment;
  const stillActive = await Assignment.exists({ childId, trainerId, status: 'active', codeUsed: true });
  if (!stillActive) {
    await Child.updateOne({ _id: childId }, { $pull: { trainers: trainerId } });
  }
};

/**
 * Если по заявке не осталось активных записей — возвращаем её администратору в «ожидает».
 * Но только если у ребёнка нет другой действующей заявки (иначе получились бы две).
 */
const reopenRequestIfEmpty = async (requestId: Types.ObjectId) => {
  const left = await Assignment.exists({ requestId, status: 'active' });
  if (left) return;
  const request = await EnrollmentRequest.findById(requestId);
  if (!request || request.status !== 'approved') return;
  const other = await EnrollmentRequest.exists({
    _id: { $ne: requestId }, childId: request.childId, status: { $in: ['pending', 'approved'] },
  });
  request.status = other ? 'cancelled' : 'pending';
  if (other) request.cancelledBy = 'admin';
  await request.save();
};

/** У одобренной заявки есть ещё действующие (не закончившиеся) записи к тренерам */
const hasLiveAssignments = (requestId: Types.ObjectId) =>
  Assignment.exists({ requestId, status: 'active', endDate: { $gte: todayStr() } });

const cancelAssignmentInternal = async (assignment: any, reason: string) => {
  assignment.status = 'cancelled';
  assignment.cancelReason = reason || undefined;
  assignment.cancelledAt = new Date();
  await assignment.save();

  await Session.updateMany(
    { assignmentId: assignment._id, status: 'scheduled', date: { $gte: todayStr() } },
    { status: 'cancelled', cancelReason: reason || 'Запись отменена администратором' }
  );

  await detachTrainerIfUnused(assignment);
};

/**
 * Вызывается при удалении аккаунта: закрываем заявки/записи/будущие занятия,
 * чтобы в календаре не оставались занятия с удалённым тренером или родителем.
 */
export const cancelEnrollmentForDeletedUser = async (userId?: string, role?: string): Promise<void> => {
  if (!userId || (role !== 'trainer' && role !== 'parent')) return;
  try {
    const field = role === 'trainer' ? 'trainerId' : 'parentId';
    const reason = role === 'trainer' ? 'Аккаунт тренера удалён' : 'Аккаунт родителя удалён';
    const assignments = await Assignment.find({ [field]: userId, status: 'active' });
    for (const a of assignments) {
      await cancelAssignmentInternal(a, reason);
      if (role === 'trainer') {
        await Notification.create({
          userId: a.parentId,
          type: 'enrollment_update',
          message: `${reason}. Занятия с ним отменены — администратор подберёт другого тренера.`,
          relatedId: a.requestId,
        });
        await reopenRequestIfEmpty(a.requestId);
      }
    }
    if (role === 'parent') {
      await EnrollmentRequest.updateMany(
        { parentId: userId, status: { $ne: 'cancelled' } },
        { status: 'cancelled', cancelledBy: 'parent' }
      );
    }
  } catch (err) {
    console.error('[enrollment] cleanup after account deletion failed:', err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// РОДИТЕЛЬ
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/enrollment/requests
export const createRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { childId, preferredDays, preferredTimeFrom, preferredTimeTo, contactPhone, comment } = req.body;

    if (!isObjectId(childId)) { res.status(400).json({ message: 'Выберите ребёнка' }); return; }

    const days = parseWeekdays(preferredDays);
    if (!days) { res.status(400).json({ message: 'Выберите хотя бы один день недели' }); return; }

    if (preferredTimeFrom && !TIME_RE.test(preferredTimeFrom)) { res.status(400).json({ message: 'Некорректное время' }); return; }
    if (preferredTimeTo && !TIME_RE.test(preferredTimeTo)) { res.status(400).json({ message: 'Некорректное время' }); return; }
    if (preferredTimeFrom && preferredTimeTo && preferredTimeFrom >= preferredTimeTo) {
      res.status(400).json({ message: 'Время «до» должно быть позже времени «с»' }); return;
    }

    const phone = typeof contactPhone === 'string' ? contactPhone.trim() : '';
    if (phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ message: 'Укажите контактный телефон' }); return;
    }

    const child = await Child.findOne({ _id: childId, parentId: req.user?.id });
    if (!child) { res.status(404).json({ message: 'Ребёнок не найден' }); return; }

    // Для записи нужны полные данные ребёнка
    if (
      !child.lastName || !isValidIin(child.iin) ||
      typeof child.adaptiveSkating?.hasExperience !== 'boolean' ||
      typeof child.skiExperience?.hasExperience !== 'boolean'
    ) {
      res.status(400).json({
        message: 'Заполните в профиле ребёнка фамилию, ИИН и ответы о катании на лыжах и адаптивном катании',
        code: 'CHILD_INCOMPLETE',
      });
      return;
    }

    // Одна действующая заявка на ребёнка: иначе при отмене записи старая заявка вернётся
    // в «ожидает» и у администратора окажутся две заявки на одного ребёнка
    let existing = await EnrollmentRequest.findOne({ childId, status: 'pending' });
    if (!existing) {
      // Одобренная заявка мешает новой, только пока по ней идут занятия.
      // Если все периоды закончились — родитель может записаться на новый срок.
      const approved = await EnrollmentRequest.find({ childId, status: 'approved' });
      for (const r of approved) {
        if (await hasLiveAssignments(r._id)) { existing = r; break; }
      }
    }
    if (existing) {
      res.status(409).json({
        message: existing.status === 'pending'
          ? 'По этому ребёнку уже есть заявка на рассмотрении'
          : 'Ребёнок уже записан на занятия. Чтобы изменить дни или добавить тренера, обратитесь к администратору',
      });
      return;
    }

    const request = await EnrollmentRequest.create({
      parentId: req.user?.id,
      childId,
      preferredDays: days,
      preferredTimeFrom: preferredTimeFrom || undefined,
      preferredTimeTo: preferredTimeTo || undefined,
      contactPhone: phone,
      comment: typeof comment === 'string' ? comment.trim() || undefined : undefined,
    });

    res.status(201).json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/enrollment/requests/my
export const getMyRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await EnrollmentRequest.find({ parentId: req.user?.id })
      .populate('childId', 'name lastName photo dateOfBirth')
      .sort({ createdAt: -1 })
      .lean();

    const assignments = await Assignment.find({ requestId: { $in: requests.map((r) => r._id) } })
      .populate('trainerId', 'name photo')
      .select('-accessCode')
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      requests.map((r) => ({
        ...r,
        assignments: assignments.filter((a) => a.requestId.toString() === r._id.toString()),
      }))
    );
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/enrollment/requests/:id/withdraw — родитель отзывает свою заявку (только пока она не обработана)
export const withdrawRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await EnrollmentRequest.findOneAndUpdate(
      { _id: req.params['id'], parentId: req.user?.id, status: 'pending' },
      { status: 'cancelled', cancelledBy: 'parent' },
      { new: true }
    );
    if (!request) { res.status(404).json({ message: 'Заявка не найдена или уже обработана' }); return; }
    res.json(request);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// АДМИНИСТРАТОР
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/enrollment/admin/requests?status=pending
export const adminGetRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query['status'];
    const filter: Record<string, unknown> = {};
    if (status === 'pending' || status === 'approved' || status === 'cancelled') filter.status = status;

    const requests = await EnrollmentRequest.find(filter)
      .populate('parentId', 'name email photo')
      .populate('childId', 'name lastName iin dateOfBirth photo diagnosis communicationMethod adaptiveSkating skiExperience')
      .sort({ createdAt: -1 })
      .lean();

    const assignments = await Assignment.find({ requestId: { $in: requests.map((r) => r._id) } })
      .populate('trainerId', 'name email photo')
      .sort({ createdAt: -1 })
      .lean();

    const counts = {
      pending: await EnrollmentRequest.countDocuments({ status: 'pending' }),
      approved: await EnrollmentRequest.countDocuments({ status: 'approved' }),
      cancelled: await EnrollmentRequest.countDocuments({ status: 'cancelled' }),
    };

    res.json({
      counts,
      requests: requests.map((r) => ({
        ...r,
        assignments: assignments.filter((a) => a.requestId.toString() === r._id.toString()),
      })),
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/enrollment/admin/trainers
export const adminGetTrainers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trainers = await User.find({ role: 'trainer' }).select('name email photo').sort({ name: 1 });
    res.json(trainers);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/enrollment/admin/requests/:id/assign
// body: { trainerId, slots: [{weekday, startTime}], durationMin, startDate, endDate }
export const adminAssign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { trainerId, slots, durationMin, startDate, endDate } = req.body;

    const request = await EnrollmentRequest.findById(req.params['id']);
    if (!request) { res.status(404).json({ message: 'Заявка не найдена' }); return; }
    if (request.status === 'cancelled') { res.status(400).json({ message: 'Заявка отменена' }); return; }

    if (!isObjectId(trainerId)) { res.status(400).json({ message: 'Выберите тренера' }); return; }
    const trainer = await User.findOne({ _id: trainerId, role: 'trainer' });
    if (!trainer) { res.status(404).json({ message: 'Тренер не найден' }); return; }

    if (!Array.isArray(slots) || slots.length === 0) {
      res.status(400).json({ message: 'Выберите дни и время занятий' }); return;
    }
    const cleanSlots: Array<{ weekday: Weekday; startTime: string }> = [];
    for (const s of slots) {
      const weekday = Number(s?.weekday);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !TIME_RE.test(s?.startTime)) {
        res.status(400).json({ message: 'Некорректный день или время занятия' }); return;
      }
      cleanSlots.push({ weekday: weekday as Weekday, startTime: s.startTime });
    }

    const duration = Number(durationMin) || 45;
    if (duration < 15 || duration > 240) { res.status(400).json({ message: 'Длительность: 15–240 минут' }); return; }

    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
      res.status(400).json({ message: 'Некорректный период занятий' }); return;
    }
    if (addDays(startDate, MAX_PERIOD_DAYS) < endDate) {
      res.status(400).json({ message: 'Период не может быть длиннее года' }); return;
    }

    const child = await Child.findById(request.childId);
    if (!child) { res.status(404).json({ message: 'Ребёнок не найден' }); return; }

    const duplicate = await Assignment.exists({ childId: child._id, trainerId: trainer._id, status: 'active' });
    if (duplicate) {
      res.status(409).json({
        message: 'Ребёнок уже записан к этому тренеру. Чтобы изменить дни или период, отмените текущую запись и создайте новую.',
      });
      return;
    }
    const parent = await User.findById(request.parentId);

    // Генерируем конкретные занятия
    const today = todayStr();
    const sessionDocs: Array<{ date: string; startTime: string; endTime: string }> = [];
    for (let d = startDate < today ? today : startDate; d <= endDate; d = addDays(d, 1)) {
      const wd = isoWeekday(d);
      for (const slot of cleanSlots) {
        if (slot.weekday === wd) {
          sessionDocs.push({ date: d, startTime: slot.startTime, endTime: addMinutes(slot.startTime, duration) });
        }
      }
    }
    if (sessionDocs.length === 0) {
      res.status(400).json({ message: 'В выбранном периоде нет ни одного занятия по выбранным дням' }); return;
    }

    // Проверка пересечений у тренера или у самого ребёнка (не блокирует — групповые занятия допустимы)
    const existing = await Session.find({
      $or: [{ trainerId: trainer._id }, { childId: child._id }],
      status: 'scheduled',
      date: { $in: [...new Set(sessionDocs.map((s) => s.date))] },
    }).select('date startTime endTime').lean();
    const conflicts = sessionDocs.filter((n) =>
      existing.some((e) => e.date === n.date && e.startTime < n.endTime && n.startTime < e.endTime)
    ).length;

    const accessCode = await generateUniqueCode();
    const assignment = await Assignment.create({
      requestId: request._id,
      childId: child._id,
      parentId: request.parentId,
      trainerId: trainer._id,
      slots: cleanSlots,
      durationMin: duration,
      startDate,
      endDate,
      accessCode,
    });

    await Session.insertMany(
      sessionDocs.map((s) => ({
        ...s,
        assignmentId: assignment._id,
        requestId: request._id,
        childId: child._id,
        parentId: request.parentId,
        trainerId: trainer._id,
      }))
    );

    request.status = 'approved';
    await request.save();

    const schedule = formatSlots(cleanSlots);
    const period = `${formatDateRu(startDate)} – ${formatDateRu(endDate)}`;

    // Тренеру — код доступа. Данные ребёнка тренер увидит только после ввода кода.
    await Notification.create({
      userId: trainer._id,
      type: 'trainer_assigned',
      message: `Администратор назначил вам нового ученика (${schedule}, ${period}). Код доступа: ${accessCode}. Введите его в разделе «Дети».`,
      relatedId: assignment._id,
    });
    const emails: Promise<void>[] = [];
    emails.push(sendNotificationEmail(
      trainer.email,
      'UmaiSense: новый ученик — код доступа',
      `<p>Администратор назначил вам нового ученика.</p>
       <p><b>Расписание:</b> ${schedule}<br/><b>Период:</b> ${period}</p>
       <p>Ваш код доступа:</p>
       <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#E07628">${accessCode}</p>
       <p>Введите код в приложении в разделе «Дети», чтобы получить доступ к профилю ребёнка.</p>`
    ));

    // Родителю — заявка одобрена
    await Notification.create({
      userId: request.parentId,
      type: 'enrollment_update',
      message: `Заявка одобрена: ${childFullName(child)} записан(а) к тренеру ${trainer.name || ''} — ${schedule} (${period}).`,
      relatedId: request._id,
    });
    if (parent?.email) {
      emails.push(sendNotificationEmail(
        parent.email,
        'UmaiSense: заявка на занятия одобрена',
        `<p>${escapeHtml(childFullName(child))} записан(а) к тренеру <b>${escapeHtml(trainer.name || '')}</b>.</p>
         <p><b>Расписание:</b> ${schedule}<br/><b>Период:</b> ${period}</p>
         <p>Все занятия есть в разделе «Расписание».</p>`
      ));
    }
    // Ждём письма параллельно (максимум ~5 с) — иначе serverless-функция может завершиться раньше отправки
    await Promise.all(emails);

    res.status(201).json({ assignment, sessionsCreated: sessionDocs.length, conflicts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/enrollment/admin/requests/:id/cancel — отмена заявки целиком (и всех её закреплений)
export const adminCancelRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const request = await EnrollmentRequest.findById(req.params['id']);
    if (!request) { res.status(404).json({ message: 'Заявка не найдена' }); return; }
    if (request.status === 'cancelled') { res.status(400).json({ message: 'Заявка уже отменена' }); return; }

    const assignments = await Assignment.find({ requestId: request._id, status: 'active' });
    for (const a of assignments) {
      await cancelAssignmentInternal(a, reason);
      await Notification.create({
        userId: a.trainerId,
        type: 'session_cancelled',
        message: `Администратор отменил закрепление ученика${reason ? `: ${reason}` : ''}. Занятия удалены из расписания.`,
        relatedId: a._id,
      });
    }

    request.status = 'cancelled';
    request.cancelledBy = 'admin';
    request.adminComment = reason || undefined;
    await request.save();

    const child = await Child.findById(request.childId).select('name lastName');
    await Notification.create({
      userId: request.parentId,
      type: 'enrollment_update',
      message: `Заявка на занятия для ${childFullName(child)} отменена администратором${reason ? `: ${reason}` : ''}.`,
      relatedId: request._id,
    });

    res.json(request);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/enrollment/admin/assignments/:id/cancel — отмена записи к конкретному тренеру
export const adminCancelAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const assignment = await Assignment.findById(req.params['id']);
    if (!assignment) { res.status(404).json({ message: 'Запись не найдена' }); return; }
    if (assignment.status === 'cancelled') { res.status(400).json({ message: 'Запись уже отменена' }); return; }

    await cancelAssignmentInternal(assignment, reason);

    const [child, trainer] = await Promise.all([
      Child.findById(assignment.childId).select('name lastName'),
      User.findById(assignment.trainerId).select('name'),
    ]);

    await Notification.create({
      userId: assignment.trainerId,
      type: 'session_cancelled',
      message: assignment.codeUsed
        ? `Администратор отменил занятия с ${childFullName(child)}${reason ? `: ${reason}` : ''}.`
        : `Администратор отменил назначение ученика (код ${assignment.accessCode} больше не действует)${reason ? `: ${reason}` : ''}.`,
      relatedId: assignment._id,
    });
    await Notification.create({
      userId: assignment.parentId,
      type: 'enrollment_update',
      message: `Запись ${childFullName(child)} к тренеру ${trainer?.name || ''} отменена администратором${reason ? `: ${reason}` : ''}.`,
      relatedId: assignment.requestId,
    });

    await reopenRequestIfEmpty(assignment.requestId);

    res.json(assignment);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/enrollment/admin/sessions/:id/cancel — отмена одного занятия
export const adminCancelSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const session = await Session.findById(req.params['id']);
    if (!session) { res.status(404).json({ message: 'Занятие не найдено' }); return; }
    if (session.status === 'cancelled') { res.status(400).json({ message: 'Занятие уже отменено' }); return; }

    session.status = 'cancelled';
    session.cancelReason = reason || undefined;
    await session.save();

    const child = await Child.findById(session.childId).select('name lastName');
    const when = `${formatDateRu(session.date)} в ${session.startTime}`;
    const msg = `Занятие ${childFullName(child)} ${when} отменено${reason ? `: ${reason}` : ''}.`;
    await Notification.create([
      { userId: session.parentId, type: 'session_cancelled', message: msg, relatedId: session._id },
      { userId: session.trainerId, type: 'session_cancelled', message: msg, relatedId: session._id },
    ]);

    res.json(session);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ТРЕНЕР
// ═══════════════════════════════════════════════════════════════════════════

const trainerCard = async (assignmentId: Types.ObjectId) => {
  const a = await Assignment.findById(assignmentId)
    .populate('childId', 'name lastName iin dateOfBirth photo diagnosis adaptiveSkating skiExperience')
    .populate('parentId', 'name email')
    .select('-accessCode')
    .lean();
  if (!a) return null;
  const request = await EnrollmentRequest.findById(a.requestId).select('contactPhone').lean();
  return { ...a, contactPhone: request?.contactPhone };
};

// POST /api/enrollment/trainer/activate  body: { code }
export const trainerActivate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!code) { res.status(400).json({ message: 'Введите код' }); return; }

    const assignment = await Assignment.findOne({ accessCode: code });
    if (!assignment || assignment.status !== 'active' || assignment.trainerId.toString() !== req.user?.id) {
      res.status(400).json({ message: 'Неверный или недействительный код' });
      return;
    }

    if (!assignment.codeUsed) {
      const before = await Child.exists({ _id: assignment.childId, trainers: assignment.trainerId });
      assignment.codeUsed = true;
      assignment.activatedAt = new Date();
      assignment.hadAccessBefore = !!before;
      await assignment.save();

      await Child.updateOne({ _id: assignment.childId }, { $addToSet: { trainers: assignment.trainerId } });
      await logAccess(req, { action: 'child.access_granted', childId: assignment.childId, meta: { assignmentId: String(assignment._id) } });

      const [child, trainer] = await Promise.all([
        Child.findById(assignment.childId).select('name lastName'),
        User.findById(assignment.trainerId).select('name'),
      ]);
      await Notification.create({
        userId: assignment.parentId,
        type: 'invite_accepted',
        message: `Тренер ${trainer?.name || ''} подтвердил(а) доступ к профилю ${childFullName(child)}.`,
        relatedId: assignment.childId,
      });
    }

    res.json(await trainerCard(assignment._id));
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/enrollment/trainer/assignments
// Неактивированные назначения отдаются без данных ребёнка — их открывает код.
export const trainerGetAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const list = await Assignment.find({ trainerId: req.user?.id, status: 'active' })
      .sort({ createdAt: -1 })
      .select('_id codeUsed')
      .lean();

    const result = await Promise.all(
      list.map(async (a) => {
        if (a.codeUsed) return trainerCard(a._id);
        const full = await Assignment.findById(a._id)
          .select('slots durationMin startDate endDate codeUsed status createdAt')
          .lean();
        return full;
      })
    );

    res.json(result.filter(Boolean));
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// КАЛЕНДАРЬ (все роли)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/enrollment/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD[&trainerId=][&childId=]
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const from = req.query['from'];
    const to = req.query['to'];
    if (!isValidDate(from) || !isValidDate(to) || from > to || addDays(from, 62) < to) {
      res.status(400).json({ message: 'Некорректный период' });
      return;
    }

    const filter: Record<string, unknown> = { date: { $gte: from, $lte: to } };
    const role = req.user?.role;

    if (role === 'parent') {
      filter.parentId = req.user?.id;
    } else if (role === 'trainer') {
      // Тренер видит только занятия по назначениям, которые он активировал кодом
      const ids = await Assignment.find({ trainerId: req.user?.id, codeUsed: true }).distinct('_id');
      filter.assignmentId = { $in: ids };
    } else if (role === 'admin') {
      if (isObjectId(req.query['trainerId'])) filter.trainerId = req.query['trainerId'];
    }
    if (isObjectId(req.query['childId'])) filter.childId = req.query['childId'];

    const sessions = await Session.find(filter)
      .populate('childId', 'name lastName photo')
      .populate('trainerId', 'name photo')
      .populate('parentId', 'name')
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json(sessions);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
