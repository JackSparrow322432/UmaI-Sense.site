import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { documentsApi } from '../../api';
import type { DocumentItem } from '../../types';

const STATUS_LABEL: Record<DocumentItem['aiStatus'], { label: string; color: string; bg: string }> = {
  pending: { label: 'Распознаётся...', color: '#E07628', bg: '#FFF3EA' },
  done:    { label: 'Разобрано ИИ',    color: '#2DD4A1', bg: '#EDFAF5' },
  failed:  { label: 'Не удалось разобрать', color: '#EF4444', bg: '#FEF2F2' },
};

function DocumentCard({ doc, onDelete }: { doc: DocumentItem; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_LABEL[doc.aiStatus];
  const uploaderName = typeof doc.uploadedBy === 'string' ? '' : doc.uploadedBy.name;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex gap-3 p-4">
        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
          <img
            src={doc.fileUrl}
            alt={doc.fileName}
            className="w-16 h-16 rounded-xl object-cover border border-gray-100"
          />
        </a>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.fileName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
            {uploaderName && ` · ${uploaderName}`}
          </p>
          <span
            className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>
        <button
          onClick={() => onDelete(doc._id)}
          className="text-xs text-red-400 hover:text-red-600 font-medium transition self-start flex-shrink-0"
        >
          Удалить
        </button>
      </div>

      {doc.aiExplanation && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#E07628] hover:bg-[#FFF3EA] transition"
          >
            {open ? '▲ Скрыть разъяснение ИИ' : '▼ Показать разъяснение ИИ'}
          </button>
          {open && (
            <p className="px-4 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {doc.aiExplanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Можно загружать только изображения (фото документа)');
      return;
    }

    setUploading(true);
    try {
      const { data } = await documentsApi.upload(id, file);
      setDocuments((prev) => [data, ...prev]);
      toast.success('Документ загружен и разобран ИИ');
    } catch {
      toast.error('Ошибка загрузки документа');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!id) return;
    if (!confirm('Удалить документ?')) return;
    try {
      await documentsApi.delete(id, documentId);
      setDocuments((prev) => prev.filter((d) => d._id !== documentId));
      toast.success('Документ удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/children/${id}/profile`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition"
      >
        ← Назад к профилю
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">📄 Документы</h1>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-[#E07628]/30 rounded-2xl py-4 text-sm font-semibold text-[#E07628] hover:bg-[#FFF3EA] transition disabled:opacity-50"
      >
        {uploading ? 'Загрузка и распознавание...' : '📎 Загрузить фото документа'}
      </button>

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
            <DocumentCard key={doc._id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
