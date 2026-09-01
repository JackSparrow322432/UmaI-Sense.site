import { Router } from 'express';
import {
  getMilestones,
  getChildMilestones,
  updateChildMilestone,
} from '../controllers/milestones.controller';
import { protect, parentOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getMilestones);
router.get('/:childId', getChildMilestones);
router.put('/:childId/:milestoneId', parentOnly, updateChildMilestone);

export default router;
