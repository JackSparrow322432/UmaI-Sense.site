import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';
import { listDocuments, uploadDocument, deleteDocument } from '../controllers/documents.controller';

const router = Router();

router.get('/:childId', protect, listDocuments);
router.post('/:childId', protect, upload.single('file'), uploadDocument);
router.delete('/:childId/:documentId', protect, deleteDocument);

export default router;
