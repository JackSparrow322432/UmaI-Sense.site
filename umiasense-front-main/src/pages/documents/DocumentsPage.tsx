import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { documentsApi } from '../../api';
import type { DocumentItem, DocumentAiStatus, ConsentType } from '../../types';
import { consentsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import DocumentAiPanel from '../../components/documents/DocumentAiPanel';
import ModalShell from '../../components/modals/ModalShell';
import ConsentCheckbox from '../../components/legal/ConsentCheckbox';
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
  doc, onOpen, onDelete, ai, explaining, onExplain,
}: {
  doc: DocumentItem;
  onOpen: (doc: DocumentItem, inline: boolean) => void;
  onDelete: (id: string) => void;
  /** null — расшифровка недоступна этому пользователю (тренер) */
  ai: DocumentAiStatus | null;
  explaining: boolean;
  onExplain: (doc: DocumentItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const uploaderName = typeof doc.uploadedBy === 'string' ? '' : doc.uploadedBy?.name;
  const kind = kindOf(doc.mimeType);
  const isImage = doc.mimeType.startsWith('image/');
  const isOldWord = doc.mimeType === 'application/msword';
  const hasResult = !!doc.aiResult;
  // Причина, по которой расшифровать нельзя (показывается подсказкой)
  const blocked = !ai ? null
    : !ai.enabled ? (ai.reason || 'ИИ не настроен')
    : isOldWord ? 'Формат .doc не поддерживается — загрузите PDF или DOCX'
    : isImage && !ai.images ? 'Фото документов не отправляются во внешний ИИ — загрузите PDF'
    : null;

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
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <button onClick={() => onOpen(doc, true)} className="text-xs text-[#E07628] font-semibold">Открыть</button>
            <button onClick={() => onOpen(doc, false)} className="text-xs text-gray-500 font-medium">Скачать</button>
            {ai && (
              <button
                onClick={() => onExplain(doc)}
                disabled={explaining || !!blocked}
                title={blocked ?? undefined}
                className="text-xs font-semibold text-sky-600 disabled:text-gray-300"
              >
                {explaining ? '🧠 Расшифровываем…' : hasResult ? '🧠 Расшифровать заново' : '🧠 Расшифровать (ИИ)'}
              </button>
            )}
          </div>
          {ai && blocked && !hasResult && <p className="text-[11px] text-gray-400 mt-1">{blocked}</p>}
          {doc.aiStatus === 'failed' && doc.aiError && !explaining && <p className="text-[11px] text-red-500 mt-1">{doc.aiError}</p>}
        </div>
        <button
          onClick={() => onDelete(doc._id)}
          className="text-xs text-red-400 hover:text-red-600 font-medium transition self-start flex-shrink-0"
        >
          Удалить
        </button>
      </div>

      {(hasResult || doc.aiExplanation) && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 transition"
          >
            {open ? '▲ Скрыть расшифровку' : `▼ Расшифровка документа${doc.aiResult?.docType ? `: ${doc.aiResult.docType}` : ''}`}
          </button>
          {open && (doc.aiResult
            ? <DocumentAiPanel result={doc.aiResult} at={doc.aiAt} />
            : <p className="px-4 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{doc.aiExplanation}</p>)}
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
  const isParent = useAuthStore((st) => st.user?.role === 'parent');
  const [ai, setAi] = useState<DocumentAiStatus | null>(null);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [consentFor, setConsentFor] = useState<DocumentItem | null>(null);
  const [agreeDocs, setAgreeDocs] = useState(false);
  const [agreeCross, setAgreeCross] = useState(false);

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

  // Расшифровка доступна только родителю ребёнка
  useEffect(() => {
    if (!id || !isParent) return;
    documentsApi.aiStatus(id).then(({ data }) => setAi(data)).catch(() => setAi(null));
  }, [id, isParent]);

  const runExplain = async (doc: DocumentItem) => {
    if (!id) return;
    setExplainingId(doc._id);
    try {
      const { data } = await documentsApi.explain(id, doc._id);
      setDocuments((prev) => prev.map((d) => (d._id === doc._id ? { ...d, ...data.document } : d)));
      toast.success('Расшифровка готова — откройте её под документом');
    } catch (err: any) {
      const d = err?.response?.data;
      if (d?.code === 'CONSENT_REQUIRED') {
        setAi((a) => (a ? { ...a, missingConsents: d.missingConsents } : a));
        setConsentFor(doc);
      } else {
        toast.error(d?.message || 'Не удалось расшифровать документ');
        fetchDocuments();
      }
    } finally {
      setExplainingId(null);
    }
  };

  const handleExplain = (doc: DocumentItem) => {
    if (ai?.missingConsents.length) { setConsentFor(doc); return; }
    void runExplain(doc);
  };

  const needDocs = ai?.missingConsents.includes('documents_ai') ?? false;
  const needCross = ai?.missingConsents.includes('cross_border') ?? false;

  const giveConsent = async () => {
    const types: ConsentType[] = [];
    if (needDocs) types.push('documents_ai');
    if (needCross) types.push('cross_border');
    try {
      await consentsApi.grant(types);
      setAi((a) => (a ? { ...a, missingConsents: [] } : a));
      const doc = consentFor;
      setConsentFor(null);
      if (doc) void runExplain(doc);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось сохранить согласие');
    }
  };

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
        {isParent && ai?.enabled && (
          <p className="text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mt-2 leading-snug">
            🧠 Нажмите «Расшифровать» у документа — ИИ объяснит его простыми словами. Расшифровки учитываются в ИИ-советах,
            ИИ-скрининге и досье ребёнка.
          </p>
        )}
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
            <DocumentCard
              key={doc._id}
              doc={doc}
              onOpen={handleOpen}
              onDelete={handleDelete}
              ai={isParent ? ai : null}
              explaining={explainingId === doc._id}
              onExplain={handleExplain}
            />
          ))}
        </div>
      )}
      {consentFor && (
        <ModalShell title="Согласие на анализ документов" onClose={() => setConsentFor(null)}>
          <div className="space-y-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              Для расшифровки текст документа отправляется в сервис ИИ. Имена, ИИН, телефоны и даты из текста удаляются
              автоматически. Согласие можно отозвать в «Настройки → Мои согласия».
            </p>
            {needDocs && (
              <ConsentCheckbox checked={agreeDocs} onChange={setAgreeDocs} required link={{ to: '/agreement#consent-documents-ai', label: '(текст согласия)' }}>
                Я даю согласие на анализ медицинских документов ребёнка искусственным интеллектом для их расшифровки и
                учёта в ИИ-советах, скрининге и досье
              </ConsentCheckbox>
            )}
            {needCross && (
              <ConsentCheckbox checked={agreeCross} onChange={setAgreeCross} required link={{ to: '/privacy#cross-border', label: '(подробнее)' }}>
                Я согласен(на) на трансграничную передачу обезличенных сведений внешнему сервису ИИ
              </ConsentCheckbox>
            )}
            <button
              type="button"
              onClick={giveConsent}
              disabled={(needDocs && !agreeDocs) || (needCross && !agreeCross)}
              className="w-full bg-[#E07628] hover:bg-[#C4641A] text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50"
            >
              Дать согласие и расшифровать
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
