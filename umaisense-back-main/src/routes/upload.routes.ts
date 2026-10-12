import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth.middleware';
import { upload, uploadImage, InvalidFileError } from '../utils/upload';
import { IMAGE_PURPOSES, ImagePurpose } from '../utils/fileTypes';

const router = Router();

router.post('/image', protect, upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'Файл не загружен' });
    return;
  }
  try {
    // ?purpose=avatar|cover — от назначения зависят минимальное и максимальное разрешение
    const q = String(req.query.purpose ?? 'avatar');
    const purpose: ImagePurpose = q in IMAGE_PURPOSES ? (q as ImagePurpose) : 'avatar';
    const url = await uploadImage(req.file, purpose);
    res.json({ url });
  } catch (err) {
    if (err instanceof InvalidFileError) {
      res.status(400).json({ message: err.message });
      return;
    }
    console.error('[Upload] Error:', err);
    res.status(500).json({ message: 'Ошибка загрузки изображения' });
  }
});

export default router;
