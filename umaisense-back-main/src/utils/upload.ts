import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

// ─── Cloudinary config ────────────────────────────────────────────────────────

const cloudinaryEnabled =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (cloudinaryEnabled) {
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
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения'));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── Upload helper ────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const uploadImage = (file: Express.Multer.File): Promise<string> => {
  return cloudinaryEnabled ? uploadToCloudinary(file) : saveLocally(file);
};

const uploadToCloudinary = (file: Express.Multer.File): Promise<string> =>
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

const saveLocally = (file: Express.Multer.File): Promise<string> =>
  new Promise((resolve, reject) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    fs.writeFile(path.join(uploadDir, filename), file.buffer, (err) => {
      if (err) return reject(err);
      resolve(`/uploads/${filename}`);
    });
  });
