import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { isPublicS3Enabled, putPublicObject } from './storage';
import { IMAGE_TYPES, MAX_IMAGE_SIZE, IMAGE_FORMATS_LABEL, ImagePurpose, matchesSignature } from './fileTypes';
import { processImage, ImageTooSmallError, ProcessedImage } from './imageProcessing';

// ─── Cloudinary config ────────────────────────────────────────────────────────

const cloudinaryEnabled =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

// Приоритет: S3 в Казахстане → Cloudinary (только до переезда, хранит за рубежом) → локальный диск (разработка)
if (isPublicS3Enabled()) {
  console.log('[Storage] Images → S3 public bucket');
} else if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Cloudinary] Image upload enabled');
} else {
  console.warn('[Cloudinary] Keys not set — falling back to local /uploads');
}

// ─── Multer (memory storage — works for both modes) ──────────────────────────

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (IMAGE_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Разрешены только изображения ${IMAGE_FORMATS_LABEL}`));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_IMAGE_SIZE },
});

// ─── Upload helper ────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../uploads');
if (!cloudinaryEnabled && !isPublicS3Enabled()) {
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn('[Upload] Не удалось создать локальную папку uploads (read-only filesystem):', err);
  }
}
export const uploadImage = async (file: Express.Multer.File, purpose: ImagePurpose = 'avatar'): Promise<string> => {
  // Проверяем реальный формат по первым байтам: MIME из браузера можно подделать
  if (!matchesSignature(IMAGE_TYPES, file.mimetype, file.buffer.subarray(0, 16))) {
    throw new InvalidFileError('Файл не является изображением');
  }
  // Конвертация HEIC/AVIF, поворот, удаление EXIF/GPS, проверка разрешения, уменьшение
  let img: ProcessedImage;
  try {
    img = await processImage(file.buffer, file.mimetype, purpose);
  } catch (err) {
    if (err instanceof ImageTooSmallError) throw new InvalidFileError(err.message);
    console.error('[Upload] image processing failed:', err);
    throw new InvalidFileError('Не удалось обработать изображение — файл повреждён или формат не поддерживается');
  }
  if (isPublicS3Enabled()) {
    const key = `images/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${img.ext}`;
    return putPublicObject(key, img.buffer, img.mimeType);
  }
  return cloudinaryEnabled ? uploadToCloudinary(img) : saveLocally(img);
};

export class InvalidFileError extends Error {}

const uploadToCloudinary = (file: ProcessedImage): Promise<string> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'umaisense',
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });

const saveLocally = (file: ProcessedImage): Promise<string> =>
  new Promise((resolve, reject) => {
    const ext = `.${file.ext}`;
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    fs.writeFile(path.join(uploadDir, filename), file.buffer, (err) => {
      if (err) return reject(err);
      resolve(`/uploads/${filename}`);
    });
  });
