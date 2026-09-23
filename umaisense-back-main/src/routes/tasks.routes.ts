import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getTaskRatings,
  getAllTaskSubmissions,
  setTaskRating,
  uploadTaskSubmission,
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

router.get('/:id/submissions', adminOnly, getAllTaskSubmissions);
router.post('/:id/submissions/:childId', upload.single('file'), uploadTaskSubmission);

export default router;
