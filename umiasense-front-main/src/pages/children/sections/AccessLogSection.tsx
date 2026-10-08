import { useEffect, useState } from 'react';
import { childrenApi } from '../../../api';
import type { AccessLogEntry, Child } from '../../../types';

const ACTION: Record<AccessLogEntry['action'], string> = {
  'document.upload': 'загрузил(а) документ',
  'document.view': 'открыл(а) документ',
  'document.delete': 'удалил(а) документ',
  'child.view': 'открыл(а) профиль',
  'child.access_granted': 'получил(а) доступ по коду',
  'screening.run': 'запустил(а) ИИ-скрининг',
  'screening.view': 'открыл(а) отчёт ИИ-скрининга',
};
const ROLE: Record<string, string> = { parent: 'Родитель', trainer: 'Тренер', admin: 'Администратор' };

/** Журнал доступа: кто и когда открывал профиль и документы ребёнка (видит только родитель) */
export default function AccessLogSection({ child }: { child: Child }) {
  const [items, setItems] = useState<AccessLogEntry[] | null>(null);

  useEffect(() => {
    childrenApi.getAccessLog(child._id).then(({ data }) => setItems(data)).catch(() => setItems([]));
  }, [child._id]);

  if (!items) return <p className="text-sm text-gray-400">Загрузка…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Кто и когда открывал профиль и документы ребёнка (последние 200 записей).
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Записей пока нет</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((e) => (
            <li key={e._id} className="py-2 flex items-start justify-between gap-3 text-sm">
              <span className="text-gray-700">
                <b className="font-medium">{e.userId?.name || 'Удалённый пользователь'}</b>
                <span className="text-gray-400"> ({ROLE[e.role ?? ''] ?? '—'})</span> {ACTION[e.action] ?? e.action}
              </span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {new Date(e.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
