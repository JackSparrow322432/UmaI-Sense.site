import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { documentsApi } from '../../api';
import type { DocumentItem } from '../../types';
import { uploadDirect } from '../../utils/directUpload';
import FileDropzone from '../../components/common/FileDropzone';
import { UPLOAD_RULES, guessMime } from '../../utils/uploadRules';

// Форматы, размер и подсказка — из общего конфига (совпадает с сервером: DOCUMENT_TYPES в fileTypes.ts)
const RULE = UPLOAD_RULES.document;

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
};

const kindOf = (mime: string) => {
  if (mime === 'application/pdf') return { label: 'PDF', color: '#EF4444', bg: '#FEF2F2' };
  if (mime.includes('word') || mime === 'application/msword') return { label: 'DOC', color: '#2563EB', bg: '#EFF6FF' };
  return { label: 'ФОТО', color: '#059669', bg: '#ECFDF5' };
};

function DocumentCard({
  doc, onOpen, onDelete,
}: { doc: DocumentItem; onOpen: (doc: DocumentItem, inline: boolean) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const uploaderName = typeof doc.uploadedBy === 'string' ? '' : doc.uploadedBy?.name;
  const kind = kindOf(doc.mimeType);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex gap-3 p-4">
        <button
          onClick={() => onOpen(doc, true)}
          className="w-14 h-14 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: kind.bg, color: kind.color }}
          title="Открыть"
        >
          {kind.label}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onOpen(doc, true)} className="block text-left text-sm font-semibold text-gray-900 truncate max-w-full hover:text-[#E07628]">
            {doc.fileName}
          </button>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
            {uploaderName && ` · ${uploaderName}`}
            {doc.size ? ` · ${formatSize(doc.size)}` : ''}
          </p>
          <div className="flex gap-3 mt-1.5">
            <button onClick={() => onOpen(doc, true)} className="text-xs text-[#E07628] font-semibold">Открыть</button>
            <button onClick={() => onOpen(doc, false)} className="text-xs text-gray-500 font-medium">Скачать</button>
          </div>
        </div>
        <button
          onClick={() => onDelete(doc._id)}
          className="text-xs text-red-400 hover:text-red-600 font-medium transition self-start flex-shrink-0"
        >
          Удалить
        </button>
      </div>

      {/* Разъяснения ИИ остались только у старых документов; новые документы в ИИ не отправляются */}
      {doc.aiExplanation && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#E07628] hover:bg-[#FFF3EA] transition"
          >
            {open ? '▲ Скрыть прежнее разъяснение ИИ' : '▼ Показать прежнее разъяснение ИИ'}
          </button>
          {open && (
            <p className="px-4 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{doc.aiExplanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);

  const fetchDocuments = async () => {
    if (!id) return;
    try {
      const { data } = await documentsApi.getAll(id);
      setDocuments(data);
    } catch {
      toast.error('Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, [id]);

  // Формат и размер уже проверены в FileDropzone
  const handleFile = async (file: File) => {
    if (!id) return;
    const mimeType = guessMime(RULE, file);

    setProgress(0);
    try {
      // 1. Разрешение и одноразовая ссылка от сервера
      const { data: slot } = await documentsApi.requestUpload(id, { fileName: file.name, mimeType, size: file.size });
      // 2. Файл идёт напрямую в закрытое хранилище, минуя сервер
      const { documentId, ...target } = slot;
      await uploadDirect(target, file, setProgress);
      // 3. Сервер проверяет файл и сохраняет документ
      const { data } = await documentsApi.completeUpload(id, documentId);
      setDocuments((prev) => [data, ...prev]);
      toast.success('Документ загружен');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка загрузки документа');
    } finally {
      setProgress(null);
    }
  };

  const handleOpen = async (doc: DocumentItem, inline: boolean) => {
    if (!id) return;
    // Окно открываем сразу (иначе браузер заблокирует всплывающее окно после await)
    const win = window.open('', '_blank');
    try {
      const { data } = await documentsApi.getDownloadUrl(id, doc._id, inline);
      if (win) win.location.href = data.url;
      else window.location.href = data.url;
    } catch (err: any) {
      win?.close();
      toast.error(err?.response?.data?.message || 'Не удалось открыть документ');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!id) return;
    if (!confirm('Удалить документ? Его нельзя будет восстановить.')) return;
    try {
      await documentsApi.delete(id, documentId);
      setDocuments((prev) => prev.filter((d) => d._id !== documentId));
      toast.success('Документ удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const uploading = progress !== null;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/children/${id}/profile`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition"
      >
        ← Назад к профилю
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">📄 Документы</h1>
        <p className="text-xs text-gray-400 mt-1">
          Медицинские заключения, справки, выписки. Файлы хранятся в закрытом хранилище и открываются
          только по ссылке, которая действует 5 минут. Каждый просмотр записывается в журнал доступа.
        </p>
      </div>

      <FileDropzone
        rule={RULE}
        title="📎 Загрузить документ"
        uploading={uploading}
        progress={progress}
        onFile={handleFile}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📄</p>
          <p className="text-sm">Пока нет загруженных документов</p>
          <p className="text-xs mt-1">Например, справка врача или заключение специалиста</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} onOpen={handleOpen} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
