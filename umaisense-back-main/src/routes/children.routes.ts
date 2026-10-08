import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import {
  getChildren,
  getChild,
  createChild,
  updateChild,
  deleteChild,
  removeTrainer,
  getAccessLog,
} from '../controllers/children.controller';
import { protect, parentOnly } from '../middleware/auth.middleware';
import { getScreeningStatus, runScreening, listScreenings, getScreening } from '../controllers/screening.controller';

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
router.param('trainerId', checkObjectId);
router.param('screeningId', checkObjectId);

router.get('/', getChildren);
router.get('/:id', getChild);
router.get('/:id/access-log', parentOnly, getAccessLog);

// ИИ-скрининг: родитель ребёнка или администратор (проверка внутри контроллера)
router.get('/:id/screening/status', getScreeningStatus);
router.get('/:id/screening', listScreenings);
router.post('/:id/screening', runScreening);
router.get('/:id/screening/:screeningId', getScreening);
router.post('/', parentOnly, createChild);
router.put('/:id', parentOnly, updateChild);
router.delete('/:id', parentOnly, deleteChild);
router.delete('/:id/trainers/:trainerId', parentOnly, removeTrainer);

export default router;
