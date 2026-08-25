import { Router } from 'express';
import {
  getChildren,
  getChild,
  createChild,
  updateChild,
  deleteChild,
  removeTrainer,
} from '../controllers/children.controller';
import { protect, parentOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getChildren);
router.get('/:id', getChild);
router.post('/', parentOnly, createChild);
router.put('/:id', parentOnly, updateChild);
router.delete('/:id', parentOnly, deleteChild);
router.delete('/:id/trainers/:trainerId', parentOnly, removeTrainer);

export default router;
