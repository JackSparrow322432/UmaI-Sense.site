import { Router } from 'express';
import { getUsers, getUserDetail, getChildDetail, getChildAudit, setAdminRole } from '../controllers/admin.controller';
import { Types } from 'mongoose';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect, adminOnly);

router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/admin', setAdminRole);
router.param('childId', (_req, res, next, value) => {
  if (!Types.ObjectId.isValid(value)) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
  next();
});
router.param('id', (_req, res, next, value) => {
  if (!Types.ObjectId.isValid(value)) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
  next();
});

router.get('/children/:childId', getChildDetail);
router.get('/children/:childId/audit', getChildAudit);

export default router;
