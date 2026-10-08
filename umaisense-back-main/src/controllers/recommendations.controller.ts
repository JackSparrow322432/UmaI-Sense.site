import { Response } from 'express';
import { Types } from 'mongoose';
import OpenAI from 'openai';
import { AuthRequest } from '../types';
import Recommendation from '../models/Recommendation';
import Child from '../models/Child';
import User from '../models/User';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import Notification from '../models/Notification';
import { Scrub, makeScrubber, childProfileLines, daysAgoLabel, MOOD_RU, CAT_RU, TAG_RU } from '../utils/anonymize';
import { hasActiveConsent } from '../utils/consent';

// ─── OpenAI client (only initialised when key is present) ────────────────────

const getOpenAI = (): OpenAI | null => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Промпт для внешнего ИИ-сервиса (OpenAI, за пределами РК). Обезличивание — utils/anonymize.ts.
 * Функция scrub создаётся на каждый запрос (без общего состояния между запросами).
 */
const buildPrompt = (child: any, emotions: any[], activities: any[], diary: any[], scrub: Scrub): string => {
  const L: string[] = [];

  L.push('Ты — опытный специалист по развитию детей с особыми потребностями.');
  L.push('Составь персональные практические рекомендации для родителя на основе реальных данных о ребёнке.');
  L.push('');
  L.push('=== ПРОФИЛЬ РЕБЁНКА ===');
  L.push(...childProfileLines(child, scrub));

  if (emotions.length > 0) {
    L.push('');
    L.push('=== ЭМОЦИИ (последние 7 дней) ===');
    emotions.forEach((e) => {
      const comment = e.comment ? ` — «${scrub(e.comment)}»` : '';
      L.push(`- ${MOOD_RU[e.mood] ?? e.mood} (${e.intensity}/5)${comment} · ${daysAgoLabel(e.createdAt)}`);
    });
  }

  if (activities.length > 0) {
    L.push('');
    L.push('=== АКТИВНОСТИ (последние 10) ===');
    activities.forEach((a) => {
      const dur = a.duration ? `, ${a.duration} мин` : '';
      const notes = a.notes ? ` — «${scrub(a.notes)}»` : '';
      L.push(`- ${scrub(a.name)} (${CAT_RU[a.category] ?? a.category}${dur})${notes} · ${daysAgoLabel(a.date)}`);
    });
  }

  if (diary.length > 0) {
    L.push('');
    L.push('=== ДНЕВНИК НАБЛЮДЕНИЙ (последние 5) ===');
    diary.forEach((d) => {
      L.push(`- [${TAG_RU[d.tag] ?? d.tag}] «${scrub(d.text)}» · ${daysAgoLabel(d.createdAt)}`);
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
    // Проверка владельца: раньше любой родитель мог прочитать рекомендации чужого ребёнка по его id
    if (!Types.ObjectId.isValid(String(req.params['childId']))) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
    const own = await Child.exists({ _id: req.params['childId'], parentId: req.user!.id });
    if (!own) { res.status(404).json({ message: 'Child not found' }); return; }
    const recommendations = await Recommendation.find({ childId: req.params['childId'] })
      .sort({ generatedAt: -1 });
    res.json(recommendations);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const generateRecommendation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(String(req.params['childId']))) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
    const child = await Child.findOne({ _id: req.params['childId'], parentId: req.user!.id });
    if (!child) { res.status(404).json({ message: 'Child not found' }); return; }

    const [recentEmotions, recentActivities, recentDiary] = await Promise.all([
      Emotion.find({ childId: child._id }).sort({ createdAt: -1 }).limit(7),
      Activity.find({ childId: child._id }).sort({ date: -1 }).limit(10),
      DiaryEntry.find({ childId: child._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    let content = FALLBACK_CONTENT;
    // Данные (даже обезличенные) уходят во внешний ИИ за пределами РК только при согласии
    // родителя на трансграничную передачу (ст. 16 Закона РК № 94-V). Без согласия — общие советы.
    const crossBorderOk = await hasActiveConsent(req.user!.id, 'cross_border');
    const openai = crossBorderOk ? getOpenAI() : null;

    if (openai) {
      // Имена для скрытия в свободном тексте: ребёнок, родитель, тренеры
      const people = await User.find({ _id: { $in: [child.parentId, ...(child.trainers ?? [])] } }).select('name').lean();
      const scrub = makeScrubber([child.name, child.lastName ?? '', ...people.map((p) => p.name)]);
      const prompt = buildPrompt(child, recentEmotions, recentActivities, recentDiary, scrub);

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
    } else if (!crossBorderOk) {
      console.warn('[AI] No cross_border consent — using general recommendations');
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
