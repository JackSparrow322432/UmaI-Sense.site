import { Router } from 'express';
import { getEmotions, addEmotion, deleteEmotion } from '../controllers/emotions.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:childId', getEmotions);
router.post('/:childId', addEmotion);
router.delete('/:childId/:emotionId', deleteEmotion);

export default router;
