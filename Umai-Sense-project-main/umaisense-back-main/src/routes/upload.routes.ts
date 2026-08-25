import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth.middleware';
import { upload, uploadImage } from '../utils/upload';

const router = Router();

router.post('/image', protect, upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'Файл не загружен' });
    return;
  }
  try {
    const url = await uploadImage(req.file);
    res.json({ url });
  } catch (err) {
    console.error('[Upload] Error:', err);
    res.status(500).json({ message: 'Ошибка загрузки изображения' });
  }
});

export default router;
