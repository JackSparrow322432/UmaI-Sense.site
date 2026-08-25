import { Router } from 'express';
import { createInvite, useInvite } from '../controllers/invites.controller';
import { protect, parentOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/create', parentOnly, createInvite);
router.post('/use', useInvite);

export default router;
