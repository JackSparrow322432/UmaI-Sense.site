/** Утилиты расписания. Все даты — строки 'YYYY-MM-DD', время — 'HH:mm'. */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAY_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const APP_TZ = process.env.APP_TZ || 'Asia/Almaty';

/** Сегодняшняя дата в часовом поясе катка */
export const todayStr = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());

const toUtc = (s: string) => new Date(`${s}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

/** 1 = Пн … 7 = Вс */
export const isoWeekday = (s: string): number => {
  const w = toUtc(s).getUTCDay();
  return w === 0 ? 7 : w;
};

export const addDays = (s: string, n: number): string => {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
};

export const isValidDate = (s: unknown): s is string =>
  typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(toUtc(s).getTime()) && fromUtc(toUtc(s)) === s;

export const addMinutes = (time: string, min: number): string => {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + min, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const formatSlots = (slots: Array<{ weekday: number; startTime: string }>): string =>
  [...slots]
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map((s) => `${WEEKDAY_SHORT[s.weekday]} ${s.startTime}`)
    .join(', ');

export const formatDateRu = (s: string): string => {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
};
