import { Router } from 'express';
import { getDiaryEntries, addDiaryEntry, deleteDiaryEntry } from '../controllers/diary.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:childId', getDiaryEntries);
router.post('/:childId', addDiaryEntry);
router.delete('/:childId/:entryId', deleteDiaryEntry);

export default router;
