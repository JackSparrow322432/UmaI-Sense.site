import { Router } from 'express';
import { getRecommendations, generateRecommendation } from '../controllers/recommendations.controller';
import { protect, parentOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:childId', parentOnly, getRecommendations);
router.post('/:childId/generate', parentOnly, generateRecommendation);

export default router;
