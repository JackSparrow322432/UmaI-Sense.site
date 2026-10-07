import { Response } from 'express';
import OpenAI from 'openai';
import { AuthRequest } from '../types';
import Recommendation from '../models/Recommendation';
import Child from '../models/Child';
import User from '../models/User';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import Notification from '../models/Notification';

// ─── OpenAI client (only initialised when key is present) ────────────────────

const getOpenAI = (): OpenAI | null => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

const getAge = (dob: Date): string => {
  const y = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (y % 10 === 1 && y % 100 !== 11) return `${y} год`;
  if ([2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100)) return `${y} года`;
  return `${y} лет`;
};

const daysAgoLabel = (date: Date): string => {
  const d = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  return `${d} дн назад`;
};

const MOOD_RU: Record<string, string> = {
  calm: 'Спокойный', happy: 'Радостный', anxious: 'Тревожный',
  overwhelmed: 'Перегруженный', sad: 'Грустный', angry: 'Злой', excited: 'Возбуждённый',
};
const CAT_RU: Record<string, string> = {
  hobby: 'Хобби', therapy: 'Терапия', study: 'Учёба',
  walk: 'Прогулка', social: 'Социальное', other: 'Другое',
};
const TAG_RU: Record<string, string> = {
  trigger: 'Триггер', mood: 'Настроение', info: 'Заметка', progress: 'Прогресс',
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Промпт для внешнего ИИ-сервиса (OpenAI, за пределами РК). Из него убраны имя, фамилия,
 * ИИН и дата рождения ребёнка. В свободном тексте (дневник, заметки) скрываются имена
 * ребёнка, родителя и тренеров (в любых падежах — по основе слова), ИИН, телефоны и email.
 * Полной гарантии обезличивания свободного текста это не даёт — см. политику конфиденциальности.
 */
const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const namePatterns = (names: string[]): RegExp[] =>
  names
    .flatMap((n) => String(n ?? '').split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    // основа слова + до 2 букв падежного окончания: Иван → Ивана, Иваном; Алия → Али: Алии, Алией.
    // Ограничение окончания не даёт задеть обычные слова (Иван ≠ Иваново).
    .map((w) => (w.length >= 4 && /[аяйьеиоуыюэaeiouy]$/i.test(w) ? w.slice(0, -1) : w))
    .map((stem) => new RegExp(`(?<![\\p{L}])${escapeRe(stem)}\\p{L}{0,2}(?![\\p{L}])`, 'giu'));

let scrubPatterns: RegExp[] = [];

const scrub = (text: string, _child?: any): string => {
  let t = String(text ?? '')
    .replace(/\b\d{12}\b/g, '[ИИН]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(\+?\d[\d\s()-]{8,}\d)/g, '[телефон]');
  for (const re of scrubPatterns) t = t.replace(re, '[имя]');
  return t;
};

const buildPrompt = (child: any, emotions: any[], activities: any[], diary: any[]): string => {
  const L: string[] = [];

  L.push('Ты — опытный специалист по развитию детей с особыми потребностями.');
  L.push('Составь персональные практические рекомендации для родителя на основе реальных данных о ребёнке.');
  L.push('');
  L.push('=== ПРОФИЛЬ РЕБЁНКА ===');
  // Имя, фамилия, ИИН и дата рождения в ИИ не передаются — только обезличенный профиль
  L.push(`Возраст: ${getAge(child.dateOfBirth)}`);
  if (child.diagnosis)           L.push(`Диагноз: ${child.diagnosis}`);
  if (child.communicationMethod) L.push(`Способ коммуникации: ${child.communicationMethod}`);
  if (child.triggers?.length)    L.push(`Триггеры: ${scrub(child.triggers.join(', '))}`);
  if (child.fears?.length)       L.push(`Страхи: ${scrub(child.fears.join(', '))}`);
  if (child.interests?.length)   L.push(`Интересы: ${scrub(child.interests.join(', '))}`);
  if (child.calmingActivities?.length) L.push(`Успокаивающие активности: ${scrub(child.calmingActivities.join(', '))}`);
  if (child.behavioralNotes)     L.push(`Поведенческие заметки: ${scrub(child.behavioralNotes, child)}`);
  const sp = child.sensoryProfile;
  if (sp) {
    const parts = [];
    if (sp.sound) parts.push(`звук: ${sp.sound}`);
    if (sp.light) parts.push(`свет: ${sp.light}`);
    if (sp.touch) parts.push(`прикосновения: ${sp.touch}`);
    if (parts.length) L.push(`Сенсорный профиль: ${parts.join(', ')}`);
  }

  if (emotions.length > 0) {
    L.push('');
    L.push('=== ЭМОЦИИ (последние 7 дней) ===');
    emotions.forEach((e) => {
      const comment = e.comment ? ` — «${scrub(e.comment, child)}»` : '';
      L.push(`- ${MOOD_RU[e.mood] ?? e.mood} (${e.intensity}/5)${comment} · ${daysAgoLabel(e.createdAt)}`);
    });
  }

  if (activities.length > 0) {
    L.push('');
    L.push('=== АКТИВНОСТИ (последние 10) ===');
    activities.forEach((a) => {
      const dur = a.duration ? `, ${a.duration} мин` : '';
      const notes = a.notes ? ` — «${scrub(a.notes, child)}»` : '';
      L.push(`- ${a.name} (${CAT_RU[a.category] ?? a.category}${dur})${notes} · ${daysAgoLabel(a.date)}`);
    });
  }

  if (diary.length > 0) {
    L.push('');
    L.push('=== ДНЕВНИК НАБЛЮДЕНИЙ (последние 5) ===');
    diary.forEach((d) => {
      L.push(`- [${TAG_RU[d.tag] ?? d.tag}] «${scrub(d.text, child)}» · ${daysAgoLabel(d.createdAt)}`);
    });
  }

  L.push('');
  L.push('=== ЗАДАЧА ===');
  L.push('На основе профиля и наблюдений выше дай конкретные персональные рекомендации на СЕГОДНЯ.');
  L.push('Ответь ТОЛЬКО JSON-объектом — никакого markdown, никакого вводного текста:');
  L.push('{');
  L.push('  "calmingTechniques": ["...", "...", "..."],');
  L.push('  "activitiesForToday": ["...", "...", "..."],');
  L.push('  "communicationTips": ["...", "...", "..."],');
  L.push('  "attentionPoints": ["...", "...", "..."]');
  L.push('}');
  L.push('');
  L.push('Правила: весь текст на русском · 3–4 пункта в каждой категории · советы конкретные и персональные, не общие.');

  return L.join('\n');
};

// ─── Fallback (API key not yet set) ──────────────────────────────────────────

const FALLBACK_CONTENT = {
  calmingTechniques: [
    'Глубокое дыхание — вдох на 4 счёта, выдох на 4 счёта',
    'Любимый предмет или игрушка как якорь спокойствия',
    'Тихое место без лишних стимулов на 5–10 минут',
    'Спокойная любимая музыка в наушниках',
  ],
  activitiesForToday: [
    'Прогулка по знакомому маршруту на свежем воздухе',
    'Рисование или лепка — свободное творчество без задания',
    'Чтение знакомой книги вместе с родителем',
  ],
  communicationTips: [
    'Говорите короткими, чёткими фразами — одна мысль за раз',
    'Давайте время на обработку — не торопите с ответом',
    'Используйте визуальные подсказки и жесты',
    'Предупреждайте о переходах заранее: «через 5 минут идём обедать»',
  ],
  attentionPoints: [
    'Следите за уровнем сенсорной нагрузки в течение дня',
    'Придерживайтесь привычного распорядка — предсказуемость снижает тревогу',
    'Хвалите за конкретные действия, а не общими словами',
  ],
};

// ─── Controllers ─────────────────────────────────────────────────────────────

export const getRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recommendations = await Recommendation.find({ childId: req.params['childId'] })
      .sort({ generatedAt: -1 });
    res.json(recommendations);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const generateRecommendation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findOne({ _id: req.params['childId'], parentId: req.user!.id });
    if (!child) { res.status(404).json({ message: 'Child not found' }); return; }

    const [recentEmotions, recentActivities, recentDiary] = await Promise.all([
      Emotion.find({ childId: child._id }).sort({ createdAt: -1 }).limit(7),
      Activity.find({ childId: child._id }).sort({ date: -1 }).limit(10),
      DiaryEntry.find({ childId: child._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    let content = FALLBACK_CONTENT;
    const openai = getOpenAI();

    if (openai) {
      // Имена для скрытия в свободном тексте: ребёнок, родитель, тренеры
      const people = await User.find({ _id: { $in: [child.parentId, ...(child.trainers ?? [])] } }).select('name').lean();
      scrubPatterns = namePatterns([child.name, child.lastName ?? '', ...people.map((p) => p.name)]);
      const prompt = buildPrompt(child, recentEmotions, recentActivities, recentDiary);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const raw = (completion.choices[0]?.message?.content ?? '').trim();
      // Strip possible markdown code fences just in case
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.calmingTechniques && parsed.activitiesForToday
            && parsed.communicationTips && parsed.attentionPoints) {
          content = parsed;
        }
      } catch {
        console.error('[AI] Could not parse OpenAI JSON response:', raw);
      }
    } else {
      console.warn('[AI] OPENAI_API_KEY not set — using placeholder recommendations');
    }

    const recommendation = await Recommendation.create({ childId: child._id, content });

    await Notification.create({
      userId: req.user!.id,
      type: 'ai_recommendation',
      message: `Готовы новые рекомендации ИИ для ${child.name}`,
      relatedId: recommendation._id,
    });

    res.status(201).json(recommendation);
  } catch (err) {
    console.error('[AI] generateRecommendation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
