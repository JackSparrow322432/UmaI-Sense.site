/**
 * Обезличивание данных ребёнка перед отправкой во внешний ИИ-сервис.
 *
 * Из профиля убираются имя, фамилия, ИИН и дата рождения (остаётся только возраст).
 * В свободном тексте (дневник, заметки, комментарии) скрываются имена ребёнка, родителя
 * и тренеров (в любых падежах — по основе слова), ИИН, телефоны и email.
 * Полной гарантии обезличивания свободного текста это не даёт — см. политику конфиденциальности.
 *
 * ВАЖНО: шаблоны имён создаются на КАЖДЫЙ запрос (makeScrubber) и не хранятся в модуле.
 * Раньше они лежали в общей переменной, и при одновременных запросах для двух детей
 * имена одного ребёнка не скрывались в данных другого.
 */

export type Scrub = (text: unknown) => string;

export const getAge = (dob: Date): string => {
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  if (y % 10 === 1 && y % 100 !== 11) return `${y} год`;
  if ([2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100)) return `${y} года`;
  return `${y} лет`;
};

export const daysAgoLabel = (date: Date): string => {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  return `${d} дн назад`;
};

export const MOOD_RU: Record<string, string> = {
  calm: 'Спокойный', happy: 'Радостный', anxious: 'Тревожный',
  overwhelmed: 'Перегруженный', sad: 'Грустный', angry: 'Злой', excited: 'Возбуждённый',
};
export const CAT_RU: Record<string, string> = {
  hobby: 'Хобби', therapy: 'Терапия', study: 'Учёба',
  walk: 'Прогулка', social: 'Социальное', other: 'Другое',
};
export const TAG_RU: Record<string, string> = {
  trigger: 'Триггер', mood: 'Настроение', info: 'Заметка', progress: 'Прогресс',
};

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const namePatterns = (names: string[]): RegExp[] =>
  names
    .flatMap((n) => String(n ?? '').split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    // основа слова + до 2 букв падежного окончания: Иван → Ивана, Иваном; Алия → Али: Алии, Алией.
    // Ограничение окончания не даёт задеть обычные слова (Иван ≠ Иваново).
    .map((w) => (w.length >= 4 && /[аяйьеиоуыюэaeiouy]$/i.test(w) ? w.slice(0, -1) : w))
    .map((stem) => new RegExp(`(?<![\\p{L}])${escapeRe(stem)}\\p{L}{0,2}(?![\\p{L}])`, 'giu'));

/** Создаёт функцию обезличивания для конкретного ребёнка (имена передаются явно). */
export const makeScrubber = (names: string[]): Scrub => {
  const patterns = namePatterns(names);
  return (text: unknown): string => {
    let t = String(text ?? '')
      .replace(/\b\d{12}\b/g, '[ИИН]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
      .replace(/(\+?\d[\d\s()-]{8,}\d)/g, '[телефон]')
      // даты вида 12.03.2019 / 2019-03-12 — могут быть датой рождения
      .replace(/\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/g, '[дата]')
      .replace(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g, '[дата]');
    for (const re of patterns) t = t.replace(re, '[имя]');
    return t;
  };
};

/** Обезличенный профиль ребёнка — строки для промпта. */
export const childProfileLines = (child: any, scrub: Scrub): string[] => {
  const L: string[] = [];
  // Имя, фамилия, ИИН и дата рождения в ИИ не передаются — только возраст
  if (child.dateOfBirth) L.push(`Возраст: ${getAge(child.dateOfBirth)}`);
  if (child.diagnosis)           L.push(`Диагноз (со слов родителя): ${scrub(child.diagnosis)}`);
  if (child.communicationMethod) L.push(`Способ коммуникации: ${scrub(child.communicationMethod)}`);
  if (child.triggers?.length)    L.push(`Триггеры: ${scrub(child.triggers.join(', '))}`);
  if (child.fears?.length)       L.push(`Страхи: ${scrub(child.fears.join(', '))}`);
  if (child.interests?.length)   L.push(`Интересы: ${scrub(child.interests.join(', '))}`);
  if (child.calmingActivities?.length) L.push(`Успокаивающие активности: ${scrub(child.calmingActivities.join(', '))}`);
  if (child.behavioralNotes)     L.push(`Поведенческие заметки: ${scrub(child.behavioralNotes)}`);
  const sp = child.sensoryProfile;
  if (sp) {
    const parts: string[] = [];
    const SP: Record<string, string> = { sound: 'звук', light: 'свет', touch: 'прикосновения', smell: 'запахи', taste: 'вкус' };
    for (const k of Object.keys(SP)) if (sp[k]) parts.push(`${SP[k]}: ${scrub(sp[k])}`);
    if (parts.length) L.push(`Сенсорный профиль: ${parts.join(', ')}`);
  }
  return L;
};
