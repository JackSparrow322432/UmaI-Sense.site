/**
 * Разрешённые форматы файлов и проверка по сигнатуре (первым байтам), а не только
 * по расширению/MIME, которые присылает браузер и которые легко подделать.
 */

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 МБ
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;     // 5 МБ

type Kind = { ext: string; label: string; check: (b: Buffer) => boolean };

const starts = (b: Buffer, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Buffer, s: string, offset = 0) => b.subarray(offset, offset + s.length).toString('latin1') === s;

const JPEG: Kind = { ext: 'jpg', label: 'JPEG', check: (b) => starts(b, [0xff, 0xd8, 0xff]) };
const PNG: Kind = { ext: 'png', label: 'PNG', check: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) };
const WEBP: Kind = { ext: 'webp', label: 'WebP', check: (b) => ascii(b, 'RIFF') && ascii(b, 'WEBP', 8) };
const GIF: Kind = { ext: 'gif', label: 'GIF', check: (b) => ascii(b, 'GIF8') };
const HEIC: Kind = {
  ext: 'heic', label: 'HEIC',
  check: (b) => ascii(b, 'ftyp', 4) && ['heic', 'heix', 'mif1', 'msf1', 'heif'].includes(b.subarray(8, 12).toString('latin1')),
};
const PDF: Kind = { ext: 'pdf', label: 'PDF', check: (b) => ascii(b, '%PDF-') };
// .docx — это ZIP-архив
const DOCX: Kind = { ext: 'docx', label: 'Word', check: (b) => starts(b, [0x50, 0x4b, 0x03, 0x04]) };
// .doc — старый формат OLE2
const DOC: Kind = { ext: 'doc', label: 'Word', check: (b) => starts(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) };

/** Документы: PDF, Word, фото/сканы */
export const DOCUMENT_TYPES: Record<string, Kind> = {
  'application/pdf': PDF,
  'application/msword': DOC,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DOCX,
  'image/jpeg': JPEG,
  'image/png': PNG,
  'image/heic': HEIC,
  'image/heif': HEIC,
};

/** Картинки интерфейса. SVG запрещён — в нём может быть исполняемый скрипт. */
export const IMAGE_TYPES: Record<string, Kind> = {
  'image/jpeg': JPEG,
  'image/png': PNG,
  'image/webp': WEBP,
  'image/gif': GIF,
};

export const matchesSignature = (types: Record<string, Kind>, mimeType: string, head: Buffer): boolean =>
  !!types[mimeType]?.check(head);

export const extFor = (types: Record<string, Kind>, mimeType: string): string => types[mimeType]?.ext ?? 'bin';

/** Безопасное имя файла для отображения (без путей и управляющих символов) */
export const cleanFileName = (name: unknown): string => {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return cleaned || 'document';
};
