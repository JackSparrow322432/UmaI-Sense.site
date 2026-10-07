import { useState } from 'react';
import ModalShell from '../modals/ModalShell';

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

/** Подтверждение отмены с необязательной причиной */
export default function ReasonModal({ title, description, confirmLabel = 'Отменить', onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-4">
        {description && <p className="text-sm text-gray-500">{description}</p>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Причина (увидят родитель и тренер)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Необязательно"
            className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition">
            Назад
          </button>
          <button onClick={submit} disabled={busy} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50">
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
