import { Router } from 'express';
import { createInvite, useInvite } from '../controllers/invites.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// Тренеров к детям теперь записывает только администратор (см. /api/enrollment).
// Старый механизм кодов от родителя закрыт.
router.post('/create', adminOnly, createInvite);
router.post('/use', useInvite);

export default router;
