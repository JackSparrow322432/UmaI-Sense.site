import sharp from 'sharp';
import convertHeic from 'heic-convert';
import { IMAGE_PURPOSES, ImagePurpose } from './fileTypes';

/**
 * Обработка загружаемых изображений перед сохранением:
 *  • HEIC/HEIF (iPhone) → JPEG: браузеры, кроме Safari, HEIC не показывают
 *    (готовая сборка sharp HEIC не читает из-за патентов на HEVC, поэтому heic-convert);
 *  • AVIF → WebP — для совместимости со старыми браузерами;
 *  • авто-поворот по EXIF-ориентации;
 *  • УДАЛЕНИЕ ВСЕХ МЕТАДАННЫХ (EXIF, GPS, модель телефона): на фото детей координаты съёмки
 *    раскрывают домашний адрес. sharp по умолчанию не переносит метаданные в результат;
 *  • проверка минимального разрешения и уменьшение до максимальной стороны.
 */

export class ImageTooSmallError extends Error {}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  ext: 'jpg' | 'png' | 'webp' | 'gif';
  width: number;
  height: number;
}

export const processImage = async (
  input: Buffer,
  mimeType: string,
  purpose: ImagePurpose = 'avatar'
): Promise<ProcessedImage> => {
  const rules = IMAGE_PURPOSES[purpose] ?? IMAGE_PURPOSES.avatar;
  let buf = input;
  let mime = mimeType;

  if (mime === 'image/heic' || mime === 'image/heif') {
    buf = Buffer.from(await convertHeic({ buffer: input, format: 'JPEG', quality: 0.9 }));
    mime = 'image/jpeg';
  }

  const animated = mime === 'image/gif';
  // limitInputPixels — защита от «бомб» вида 50000×50000 пикселей
  const img = sharp(buf, { animated, limitInputPixels: 40_000_000 }).rotate();
  const meta = await img.metadata();
  // после rotate() ширина/высота для ориентаций 5–8 меняются местами
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  const frameHeight = animated && meta.pageHeight ? meta.pageHeight : height;

  if (width < rules.minWidth || frameHeight < rules.minHeight) {
    throw new ImageTooSmallError(
      `Слишком маленькое изображение (${width}×${frameHeight} px). Минимум — ${rules.minWidth}×${rules.minHeight} px.`
    );
  }

  const resized = img.resize({ width: rules.maxSide, height: rules.maxSide, fit: 'inside', withoutEnlargement: true });

  let out: sharp.Sharp;
  let outMime: ProcessedImage['mimeType'];
  let ext: ProcessedImage['ext'];
  if (mime === 'image/png') { out = resized.png({ compressionLevel: 9 }); outMime = 'image/png'; ext = 'png'; }
  else if (mime === 'image/webp' || mime === 'image/avif') { out = resized.webp({ quality: 85 }); outMime = 'image/webp'; ext = 'webp'; }
  else if (animated) { out = resized.gif(); outMime = 'image/gif'; ext = 'gif'; }
  else { out = resized.jpeg({ quality: 85, mozjpeg: true }); outMime = 'image/jpeg'; ext = 'jpg'; }

  const { data, info } = await out.toBuffer({ resolveWithObject: true });
  return { buffer: data, mimeType: outMime, ext, width: info.width, height: info.height };
};
