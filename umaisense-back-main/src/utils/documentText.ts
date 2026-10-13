import { DocumentModelLike } from './documentText.types';
import { downloadStored, canReadStored, downloadLegacyUrl, StorageProvider } from './documentStorage';

/**
 * Извлечение текста из документов ребёнка для ИИ-скрининга, расшифровки и советов.
 * Текст извлекается НА НАШЕМ СЕРВЕРЕ; перед отправкой в ИИ из него удаляются имена, ИИН,
 * телефоны, email и даты (utils/anonymize.ts).
 *
 *  • PDF  — pdf-parse (v2, современный pdf.js)
 *  • DOCX — mammoth
 *  • фото и сканы (JPG/PNG/WebP/HEIC) — локальный OCR tesseract.js (rus/kaz/eng): само фото
 *    никуда не отправляется, во внешний ИИ уходит только обезличенный распознанный текст.
 *  • DOC (старый Word) — не поддерживается, пропускается.
 */

const MAX_CHARS_PER_DOC = 6000;

const loadOptional = (name: string): any => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name);
  } catch {
    return null;
  }
};

// Буквальные require (а не через переменную) — так зависимость видна сборщикам и анализаторам
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadPdfParse = (): any => { try { return require('pdf-parse'); } catch { return null; } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadMammoth = (): any => { try { return require('mammoth'); } catch { return null; } };

const extractPdf = async (buf: Buffer): Promise<string> => {
  const mod = loadPdfParse();
  if (!mod?.PDFParse) throw new Error('pdf-parse not installed');
  const parser = new mod.PDFParse({ data: buf });
  try {
    // первые 15 страниц достаточно для заключений и выписок
    const r = await parser.getText({ first: 15 });
    return String(r.text ?? '').replace(/-- \d+ of \d+ --/g, ' ');
  } finally {
    await parser.destroy().catch(() => {});
  }
};

const extractDocx = async (buf: Buffer): Promise<string> => {
  const mammoth = loadMammoth();
  if (!mammoth) throw new Error('mammoth not installed');
  const r = await mammoth.extractRawText({ buffer: buf });
  return String(r.value ?? '');
};

// Языковые данные OCR лежат в npm-пакетах @tesseract.js-data/* внутри образа — во время работы
// ничего не скачивается из интернета. tesseract.js принимает один каталог, поэтому при первом
// вызове файлы копируются во временный каталог (в контейнере /tmp — tmpfs).
const OCR_LANGS = ['rus', 'kaz', 'eng'];
let ocrDir: string | null = null;
const prepareOcrData = (): string | null => {
  if (ocrDir) return ocrDir;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs'); const path = require('path'); const os = require('os');
    const dir = path.join(os.tmpdir(), 'umaisense-tessdata');
    fs.mkdirSync(dir, { recursive: true });
    for (const lang of OCR_LANGS) {
      const pkgDir = path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
      const src = path.join(pkgDir, '4.0.0_best_int', `${lang}.traineddata.gz`);
      const dst = path.join(dir, `${lang}.traineddata.gz`);
      if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    }
    ocrDir = dir;
    return dir;
  } catch {
    return null;
  }
};

/** Доступно ли распознавание текста на фото (локально, без внешних сервисов) */
export const ocrAvailable = (): boolean => !!loadOptional('tesseract.js') && !!prepareOcrData();

const extractImage = async (buf: Buffer, mimeType: string): Promise<string> => {
  const tesseract = loadOptional('tesseract.js');
  const langPath = prepareOcrData();
  if (!tesseract || !langPath) throw new Error('OCR is not available (tesseract.js not installed)');
  // HEIC/AVIF/WebP → PNG в оттенках серого, до 2500 px, с поворотом по EXIF: так OCR точнее
  let input = buf;
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const convertHeic = require('heic-convert');
    input = Buffer.from(await convertHeic({ buffer: buf, format: 'JPEG', quality: 0.95 }));
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = require('sharp');
  const png = await sharp(input, { limitInputPixels: 60_000_000 }).rotate()
    .resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true })
    .grayscale().normalize().png().toBuffer();
  const worker = await tesseract.createWorker(OCR_LANGS, 1, { langPath, cachePath: langPath, gzip: true, logger: () => {} });
  try {
    const { data } = await worker.recognize(png);
    return String(data?.text ?? '');
  } finally {
    await worker.terminate();
  }
};

export interface ExtractedDoc { kind: string; text: string }

export const extractDocumentText = async (doc: DocumentModelLike): Promise<ExtractedDoc | null> => {
  const provider: StorageProvider = doc.storageProvider === 'cloudinary' ? 'cloudinary' : 's3';
  let buf: Buffer;
  if (doc.storageKey && canReadStored(provider)) buf = await downloadStored(provider, doc.storageKey);
  else if (!doc.storageKey && (doc as any).fileUrl) buf = await downloadLegacyUrl((doc as any).fileUrl);
  else return null;
  let text = '';
  if (doc.mimeType === 'application/pdf') text = await extractPdf(buf);
  else if (doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') text = await extractDocx(buf);
  else if (doc.mimeType.startsWith('image/')) text = await extractImage(buf, doc.mimeType);
  else return null;
  text = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS_PER_DOC);
  return text ? { kind: doc.mimeType, text } : null;
};
