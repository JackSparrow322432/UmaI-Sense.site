import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import {
  createRequest, getMyRequests, withdrawRequest,
  adminGetRequests, adminGetTrainers, adminAssign, adminCancelRequest, adminCancelAssignment, adminCancelSession,
  trainerActivate, trainerGetAssignments,
  getSessions,
} from '../controllers/enrollment.controller';
import { protect, parentOnly, adminOnly, trainerOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// Некорректный id в URL → 400, а не 500 от CastError Mongoose
const checkObjectId = (req: Request, res: Response, next: NextFunction, value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    res.status(400).json({ message: 'Некорректный идентификатор' });
    return;
  }
  next();
};
router.param('id', checkObjectId);

// Родитель — заявки
router.post('/requests', parentOnly, createRequest);
router.get('/requests/my', parentOnly, getMyRequests);
router.put('/requests/:id/withdraw', parentOnly, withdrawRequest);

// Администратор — обработка заявок, запись к тренерам, отмена
router.get('/admin/requests', adminOnly, adminGetRequests);
router.get('/admin/trainers', adminOnly, adminGetTrainers);
router.post('/admin/requests/:id/assign', adminOnly, adminAssign);
router.put('/admin/requests/:id/cancel', adminOnly, adminCancelRequest);
router.put('/admin/assignments/:id/cancel', adminOnly, adminCancelAssignment);
router.put('/admin/sessions/:id/cancel', adminOnly, adminCancelSession);

// Тренер — код доступа и назначения
router.post('/trainer/activate', trainerOnly, trainerActivate);
router.get('/trainer/assignments', trainerOnly, trainerGetAssignments);

// Календарь — все роли (фильтрация по роли внутри)
router.get('/sessions', getSessions);

export default router;
