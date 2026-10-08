import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { getMyConsents, grantConsents, withdrawConsent } from '../controllers/consents.controller';

const router = Router();

router.use(protect);

router.get('/', getMyConsents);
router.post('/', grantConsents);
router.post('/withdraw', withdrawConsent);

export default router;
