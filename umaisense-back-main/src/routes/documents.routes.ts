import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { protect } from '../middleware/auth.middleware';
import {
  listDocuments, createUploadUrl, completeUpload, getDownloadUrl, deleteDocument,
} from '../controllers/documents.controller';

const router = Router();

router.use(protect);

const checkObjectId = (_req: Request, res: Response, next: NextFunction, value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    res.status(400).json({ message: 'Некорректный идентификатор' });
    return;
  }
  next();
};
router.param('childId', checkObjectId);
router.param('documentId', checkObjectId);

router.get('/:childId', listDocuments);
router.post('/:childId/upload-url', createUploadUrl);
router.post('/:childId/:documentId/complete', completeUpload);
router.get('/:childId/:documentId/download', getDownloadUrl);
router.delete('/:childId/:documentId', deleteDocument);

export default router;
