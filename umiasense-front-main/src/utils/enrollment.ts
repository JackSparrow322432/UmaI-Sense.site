import type { Child, ScheduleSlot, Weekday } from '../types';

export const WEEKDAYS: { value: Weekday; short: string; full: string }[] = [
  { value: 1, short: 'Пн', full: 'Понедельник' },
  { value: 2, short: 'Вт', full: 'Вторник' },
  { value: 3, short: 'Ср', full: 'Среда' },
  { value: 4, short: 'Чт', full: 'Четверг' },
  { value: 5, short: 'Пт', full: 'Пятница' },
  { value: 6, short: 'Сб', full: 'Суббота' },
  { value: 7, short: 'Вс', full: 'Воскресенье' },
];

export const weekdayShort = (d: number) => WEEKDAYS[d - 1]?.short ?? '';

export const formatDays = (days: number[]) =>
  [...days].sort((a, b) => a - b).map(weekdayShort).join(', ');

export const formatSlots = (slots: ScheduleSlot[]) =>
  [...slots]
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map((s) => `${weekdayShort(s.weekday)} ${s.startTime}`)
    .join(', ');

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' */
export const formatDateRu = (s?: string) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

/** Локальная дата → 'YYYY-MM-DD' (без сдвига часового пояса) */
export const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const childFullName = (c?: Pick<Child, 'name' | 'lastName'> | null) =>
  [c?.name, c?.lastName].filter(Boolean).join(' ');

/** Проверка ИИН РК: 12 цифр + контрольный разряд */
export const isValidIin = (value: string): boolean => {
  if (!/^\d{12}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
  let c = w1.reduce((s, w, i) => s + w * d[i], 0) % 11;
  if (c === 10) {
    c = w2.reduce((s, w, i) => s + w * d[i], 0) % 11;
    if (c === 10) return false;
  }
  return c === d[11];
};

/** Данные ребёнка, без которых нельзя подать заявку */
export const isChildReadyForEnrollment = (c: Child) =>
  !!c.lastName && !!c.iin && isValidIin(c.iin) && typeof c.adaptiveSkating?.hasExperience === 'boolean';

export const REQUEST_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'На рассмотрении', color: '#B45309', bg: '#FEF3C7' },
  approved:  { label: 'Записан',         color: '#047857', bg: '#D1FAE5' },
  cancelled: { label: 'Отменена',        color: '#6B7280', bg: '#F3F4F6' },
};

/**
 * Первые 6 цифр ИИН — дата рождения ГГММДД. Возвращает true, если ИИН и дата рождения
 * ('YYYY-MM-DD') не противоречат друг другу (или проверить пока нечего).
 */
export const iinMatchesBirthDate = (iin: string, dob: string): boolean => {
  if (iin.length < 6 || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return true;
  return iin.slice(0, 6) === dob.slice(2, 4) + dob.slice(5, 7) + dob.slice(8, 10);
};
