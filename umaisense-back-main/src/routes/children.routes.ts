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

router.get('/', getChildren);
router.get('/:id', getChild);
router.get('/:id/access-log', parentOnly, getAccessLog);
router.post('/', parentOnly, createChild);
router.put('/:id', parentOnly, updateChild);
router.delete('/:id', parentOnly, deleteChild);
router.delete('/:id/trainers/:trainerId', parentOnly, removeTrainer);

export default router;
