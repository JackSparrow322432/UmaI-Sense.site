import { Router } from 'express';
import { getActivities, addActivity, deleteActivity } from '../controllers/activities.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:childId', getActivities);
router.post('/:childId', addActivity);
router.delete('/:childId/:activityId', deleteActivity);

export default router;
