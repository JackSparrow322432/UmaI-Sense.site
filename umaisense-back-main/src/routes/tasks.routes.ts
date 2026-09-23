import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.middleware';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getTaskRatings,
  setTaskRating,
  deleteTaskRating,
} from '../controllers/tasks.controller';

const router = Router();

router.use(protect);

router.get('/',    getTasks);
router.get('/:id', getTask);
router.post('/',      adminOnly, createTask);
router.put('/:id',    adminOnly, updateTask);
router.delete('/:id', adminOnly, deleteTask);

router.get('/:id/ratings', getTaskRatings);
router.put('/:id/ratings/:childId', setTaskRating);
router.delete('/:id/ratings/:childId', deleteTaskRating);

export default router;
