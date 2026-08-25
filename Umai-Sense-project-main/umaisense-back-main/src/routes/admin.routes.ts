import { Router } from 'express';
import { getUsers, getUserDetail, getChildDetail } from '../controllers/admin.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect, adminOnly);

router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.get('/children/:childId', getChildDetail);

export default router;
