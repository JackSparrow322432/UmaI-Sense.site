import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type UploadRule, acceptFor, validateFile } from '../../utils/uploadRules';

/**
 * Единая рамка загрузки файла: клик или перетаскивание, превью, прогресс, ошибки
 * и ПОДСКАЗКА ВНУТРИ РАМКИ — какие форматы, размер и разрешение принимаются.
 * Подсказка и проверки берутся из utils/uploadRules.ts (совпадают с сервером).
 *
 * variant="avatar" — квадратное превью слева и подсказка справа (фото профиля/ребёнка)
 * variant="wide"   — широкая рамка (документы, обложки, выполненные задания)
 */
interface Props {
  rule: UploadRule;
  onFile: (file: File) => void | Promise<void>;
  variant?: 'avatar' | 'wide';
  title: string;
  preview?: string;
  uploading?: boolean;
  /** 0–100; если не задан — показывается просто индикатор загрузки */
  progress?: number | null;
  disabled?: boolean;
  className?: string;
}

const CameraIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export default function FileDropzone({
  rule, onFile, variant = 'wide', title, preview, uploading = false, progress = null, disabled = false, className = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || disabled;

  const handle = async (file: File | undefined) => {
    if (!file || busy) return;
    const problem = await validateFile(rule, file);
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    setError(null);
    await onFile(file);
  };

  const open = () => { if (!busy) inputRef.current?.click(); };

  const frame =
    `relative w-full overflow-hidden border-2 border-dashed rounded-2xl transition text-left ` +
    (dragOver ? 'border-[#E07628] bg-[#FFF3EA] ' : error ? 'border-red-300 bg-red-50/40 ' : 'border-gray-200 hover:border-[#E07628] hover:bg-[#FFF8F2] ') +
    (busy ? 'cursor-wait opacity-90 ' : 'cursor-pointer ');

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptFor(rule)}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void handle(f); }}
      />
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-describedby={hintId}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handle(e.dataTransfer.files?.[0]); }}
        className={frame + (variant === 'avatar' ? 'flex items-center gap-4 p-3' : 'flex flex-col items-center gap-1.5 px-4 py-5 text-center')}
      >
        {uploading && progress !== null && (
          <span className="absolute inset-y-0 left-0 bg-[#FFF3EA] transition-all" style={{ width: `${progress}%` }} aria-hidden="true" />
        )}

        {variant === 'avatar' ? (
          <span className="relative shrink-0 w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden text-gray-300">
            {preview ? <img src={preview} className="w-full h-full object-cover" alt="" /> : <CameraIcon />}
            {uploading && (
              <span className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
              </span>
            )}
          </span>
        ) : (
          <span className="relative text-[#E07628]">
            {preview ? <img src={preview} className="max-h-32 rounded-xl object-cover" alt="" /> : <UploadIcon />}
          </span>
        )}

        <span className="relative min-w-0">
          <span className="block text-sm font-semibold text-gray-800">
            {uploading ? (progress !== null ? `Загрузка… ${progress}%` : 'Загрузка…') : title}
          </span>
          <span className="block text-xs text-gray-400 mt-0.5">
            {dragOver ? 'Отпустите файл, чтобы загрузить' : 'Нажмите или перетащите файл сюда'}
          </span>
          <span id={hintId} className="block text-[11px] leading-snug text-gray-500 mt-1.5">
            {rule.hint}
          </span>
        </span>
      </button>
      {error && <p role="alert" className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}
