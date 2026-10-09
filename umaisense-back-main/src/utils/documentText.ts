import { DocumentModelLike } from './documentText.types';
import { downloadStored, isProviderAvailable, StorageProvider } from './documentStorage';

/**
 * Извлечение текста из документов ребёнка — ТОЛЬКО для ИИ-модели, размещённой в РК
 * (AI_SCREENING_PROVIDER=local). Во внешний ИИ текст документов не передаётся никогда.
 *
 *  • PDF  — pdf-parse (v2, современный pdf.js)
 *  • DOCX — mammoth
 *  • фото и сканы (JPG/PNG/WebP/HEIC) — OCR через tesseract.js, если пакет установлен
 *    (npm i tesseract.js; ему нужны языковые данные rus/kaz/eng). Без него фото пропускаются.
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

// Буквальные require (а не через переменную): иначе сборщик Vercel не включит пакет в функцию
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

const extractImage = async (buf: Buffer): Promise<string> => {
  const tesseract = loadOptional('tesseract.js');
  if (!tesseract) throw new Error('OCR is not available (tesseract.js not installed)');
  const worker = await tesseract.createWorker(['rus', 'kaz', 'eng']);
  try {
    const { data } = await worker.recognize(buf);
    return String(data?.text ?? '');
  } finally {
    await worker.terminate();
  }
};

export interface ExtractedDoc { kind: string; text: string }

export const extractDocumentText = async (doc: DocumentModelLike): Promise<ExtractedDoc | null> => {
  const provider: StorageProvider = doc.storageProvider === 'cloudinary' ? 'cloudinary' : 's3';
  if (!doc.storageKey || !isProviderAvailable(provider)) return null;
  const buf = await downloadStored(provider, doc.storageKey);
  let text = '';
  if (doc.mimeType === 'application/pdf') text = await extractPdf(buf);
  else if (doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') text = await extractDocx(buf);
  else if (doc.mimeType.startsWith('image/')) text = await extractImage(buf);
  else return null;
  text = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS_PER_DOC);
  return text ? { kind: doc.mimeType, text } : null;
};
