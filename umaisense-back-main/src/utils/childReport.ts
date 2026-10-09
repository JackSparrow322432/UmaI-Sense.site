import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import Child from '../models/Child';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import DocumentModel from '../models/Document';
import Recommendation from '../models/Recommendation';
import Screening from '../models/Screening';
import EnrollmentRequest from '../models/EnrollmentRequest';
import Assignment from '../models/Assignment';
import Session from '../models/Session';
import Consent from '../models/Consent';
import { ChildMilestone } from '../models/Milestone';
import { MOOD_RU, CAT_RU, TAG_RU, getAge } from './anonymize';
import { formatSlots, todayStr } from './schedule';

/**
 * PDF-отчёт по профилю ребёнка для администратора.
 * Шрифт DejaVu Sans встроен в отчёт (кириллица; стандартные шрифты PDF её не поддерживают).
 * Файлы шрифтов лежат в assets/fonts и включены в функцию Vercel через vercel.json → includeFiles.
 */

const FONT_DIR = path.join(__dirname, '../../assets/fonts');
const FONT = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');

const ORANGE = '#E07628';
const DARK = '#1F2937';
const GRAY = '#6B7280';
const LIGHT = '#F3F4F6';

const PERIOD_DAYS = 30;

const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Almaty' }) : '—';
const fmtDateTime = (d: Date) =>
  new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
/** ИИН в отчёте маскируется: файл может уйти за пределы системы (печать, почта) */
const maskIin = (iin?: string) => (iin && iin.length === 12 ? `${iin.slice(0, 4)}••••••${iin.slice(10)}` : iin || '—');
const list = (a?: string[]) => (a && a.length ? a.join(', ') : '—');
const clip = (s: unknown, n = 400) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const DIRECTION_RU: Record<string, string> = {
  cognitive: 'Познание', motor: 'Моторика', social: 'Социальное', speech: 'Речь', selfcare: 'Самообслуживание',
};
const LEVEL_RU: Record<string, string> = { low: 'низкий', medium: 'средний', high: 'высокий' };
const CONSENT_RU: Record<string, string> = {
  account: 'Обработка ПД родителя', child_data: 'Обработка данных ребёнка', third_party_transfer: 'Передача третьим лицам',
  cross_border: 'Трансграничная передача (ИИ)', ai_screening: 'ИИ-скрининг', documents_ai: 'Анализ текста документов ИИ',
};
const REQUEST_STATUS_RU: Record<string, string> = { pending: 'на рассмотрении', approved: 'одобрена', cancelled: 'отменена' };

export class ChildNotFoundError extends Error {}

/** Собирает данные и возвращает PDF-файл отчёта */
export const buildChildReportPdf = async (
  childId: string,
  generatedBy: { name?: string; email?: string }
): Promise<{ buffer: Buffer; fileName: string }> => {
  const child: any = await Child.findById(childId)
    .populate('parentId', 'name email')
    .populate('trainers', 'name email')
    .lean();
  if (!child) throw new ChildNotFoundError('Child not found');

  const id = new Types.ObjectId(childId);
  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 3600 * 1000);
  const [
    emotions, activities, diary, milestones, docs, rec, screening, request, assignments, nextSessions, consents,
  ] = await Promise.all([
    Emotion.find({ childId: id, createdAt: { $gte: since } }).lean(),
    Activity.find({ childId: id, date: { $gte: since } }).lean(),
    DiaryEntry.find({ childId: id }).sort({ createdAt: -1 }).limit(10).populate('author', 'name role').lean(),
    ChildMilestone.find({ childId: id }).populate('milestoneId', 'skill direction').lean(),
    DocumentModel.find({ childId: id, status: 'ready' }).sort({ createdAt: -1 }).select('fileName mimeType size createdAt').lean(),
    Recommendation.findOne({ childId: id }).sort({ generatedAt: -1 }).lean(),
    Screening.findOne({ childId: id, status: 'done' }).sort({ createdAt: -1 }).lean(),
    EnrollmentRequest.findOne({ childId: id }).sort({ createdAt: -1 }).lean(),
    Assignment.find({ childId: id, status: 'active' }).populate('trainerId', 'name').lean(),
    Session.find({ childId: id, status: 'scheduled', date: { $gte: todayStr() } }).sort({ date: 1, startTime: 1 }).limit(5).populate('trainerId', 'name').lean(),
    Consent.find({ userId: child.parentId?._id, withdrawnAt: { $exists: false } }).select('type version createdAt childId').lean(),
  ]);

  // ─── PDF ────────────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 50, right: 50 }, bufferPages: true, info: {
    Title: `Отчёт: ${child.name} ${child.lastName ?? ''}`.trim(), Author: 'UmaiSense', Subject: 'Отчёт по профилю ребёнка',
  } });
  doc.registerFont('regular', fs.readFileSync(FONT));
  doc.registerFont('bold', fs.readFileSync(FONT_BOLD));
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const X = doc.page.margins.left;

  const ensure = (h: number) => {
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };
  const heading = (t: string) => {
    ensure(40);
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(X, y, 3, 14).fill(ORANGE);
    doc.font('bold').fontSize(12).fillColor(DARK).text(t, X + 10, y, { width: W - 10 });
    doc.moveDown(0.35);
  };
  const kv = (rows: [string, string][]) => {
    for (const [k, v] of rows) {
      const h = Math.max(doc.font('regular').fontSize(9.5).heightOfString(v || '—', { width: W - 150 }), 12);
      ensure(h + 4);
      const y = doc.y;
      doc.font('regular').fontSize(9).fillColor(GRAY).text(k, X, y, { width: 140 });
      doc.font('regular').fontSize(9.5).fillColor(DARK).text(v || '—', X + 150, y, { width: W - 150 });
      doc.y = y + h + 4;
    }
  };
  const para = (t: string, opts: { color?: string; size?: number } = {}) => {
    doc.font('regular').fontSize(opts.size ?? 9.5).fillColor(opts.color ?? DARK);
    ensure(doc.heightOfString(t, { width: W }) + 4);
    doc.text(t, X, doc.y, { width: W });
    doc.moveDown(0.25);
  };
  const bullets = (items: string[], empty = 'Нет данных') => {
    if (!items.length) return para(empty, { color: GRAY });
    for (const it of items) {
      doc.font('regular').fontSize(9.5);
      ensure(doc.heightOfString(it, { width: W - 14 }) + 3);
      const y = doc.y;
      doc.fillColor(ORANGE).text('•', X, y);
      doc.fillColor(DARK).text(it, X + 12, y, { width: W - 12 });
      doc.moveDown(0.15);
    }
  };
  const table = (head: string[], rows: string[][], widths: number[]) => {
    const drawRow = (cells: string[], bold = false, bg?: string) => {
      doc.font(bold ? 'bold' : 'regular').fontSize(8.5);
      const h = Math.max(...cells.map((c, i) => doc.heightOfString(c || '—', { width: widths[i] - 8 }))) + 8;
      ensure(h);
      const y = doc.y;
      if (bg) doc.rect(X, y, W, h).fill(bg);
      let x = X;
      cells.forEach((c, i) => {
        doc.fillColor(bold ? GRAY : DARK).text(c || '—', x + 4, y + 4, { width: widths[i] - 8 });
        x += widths[i];
      });
      doc.moveTo(X, y + h).lineTo(X + W, y + h).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
      doc.y = y + h;
    };
    drawRow(head, true, LIGHT);
    if (!rows.length) drawRow(head.map((_, i) => (i === 0 ? 'Нет данных' : '')));
    rows.forEach((r) => drawRow(r));
    doc.moveDown(0.3);
  };

  // Шапка
  doc.rect(0, 0, doc.page.width, 92).fill(ORANGE);
  doc.font('bold').fontSize(18).fillColor('#FFFFFF').text('Отчёт по профилю ребёнка', X, 26, { width: W });
  doc.font('regular').fontSize(9.5).fillColor('#FFF3EA')
    .text(`UmaiSense · сформирован ${fmtDateTime(new Date())} · ${generatedBy.name || generatedBy.email || 'администратор'}`, X, 52, { width: W });
  doc.y = 106;
  doc.font('regular').fontSize(8).fillColor('#B45309')
    .text('КОНФИДЕНЦИАЛЬНО. Содержит персональные данные и сведения о здоровье ребёнка (Закон РК «О персональных данных и их защите»). Не передавайте третьим лицам без согласия законного представителя.', X, doc.y, { width: W });

  // 1. Ребёнок
  heading('1. Основные сведения');
  const ski = child.skiExperience;
  const skating = child.adaptiveSkating;
  kv([
    ['Ребёнок', `${child.name} ${child.lastName ?? ''}`.trim()],
    ['Дата рождения', `${fmtDate(child.dateOfBirth)} (${child.dateOfBirth ? getAge(child.dateOfBirth) : '—'})`],
    ['ИИН', maskIin(child.iin)],
    ['Диагноз (со слов родителя)', child.diagnosis || '—'],
    ['Способ общения', child.communicationMethod || '—'],
    ['Лыжи', ski && typeof ski.hasExperience === 'boolean' ? (ski.hasExperience ? `катался(ась)${ski.when ? `: ${ski.when}` : ''}` : 'не катался(ась)') : '—'],
    ['Адаптивное катание', skating && typeof skating.hasExperience === 'boolean'
      ? (skating.hasExperience ? `да${skating.when ? `, ${skating.when}` : ''}${skating.details ? ` — ${clip(skating.details, 200)}` : ''}` : 'нет') : '—'],
    ['Профиль создан', fmtDate(child.createdAt)],
  ]);

  // 2. Семья и специалисты
  heading('2. Родитель и специалисты');
  kv([
    ['Родитель', child.parentId ? `${child.parentId.name || '—'} · ${child.parentId.email || ''}` : '—'],
    ['Телефон (из заявки)', request?.contactPhone || '—'],
    ['Тренеры с доступом', (child.trainers ?? []).map((t: any) => t.name || t.email).join(', ') || '—'],
    ['Заявка на занятия', request ? `${REQUEST_STATUS_RU[request.status] ?? request.status} · от ${fmtDate(request.createdAt)}` : 'нет'],
  ]);
  if (assignments.length) {
    table(['Тренер', 'Расписание', 'Период', 'Код активирован'],
      assignments.map((a: any) => [a.trainerId?.name || '—', formatSlots(a.slots || []), `${a.startDate} — ${a.endDate}`, a.codeUsed ? 'да' : 'нет']),
      [130, 150, 125, W - 405]);
  }
  if (nextSessions.length) {
    para('Ближайшие занятия:', { color: GRAY, size: 9 });
    bullets(nextSessions.map((s: any) => `${s.date} ${s.startTime}–${s.endTime} · ${s.trainerId?.name || ''}`));
  }

  // 3. Особенности
  heading('3. Особенности ребёнка');
  const sp = child.sensoryProfile || {};
  kv([
    ['Страхи', list(child.fears)],
    ['Триггеры', list(child.triggers)],
    ['Интересы', list(child.interests)],
    ['Что успокаивает', list(child.calmingActivities)],
    ['Сенсорика: звук', sp.sound || '—'],
    ['Сенсорика: свет', sp.light || '—'],
    ['Сенсорика: прикосновения', sp.touch || '—'],
    ['Сенсорика: запахи / вкус', [sp.smell, sp.taste].filter(Boolean).join(' / ') || '—'],
    ['Поведение', clip(child.behavioralNotes, 600) || '—'],
  ]);
  if (child.goals?.length) {
    para('Цели:', { color: GRAY, size: 9 });
    bullets(child.goals.map((g: any) => `${g.title}${g.description ? ` — ${clip(g.description, 200)}` : ''}`));
  }

  // 4. Наблюдения за период
  heading(`4. Наблюдения за последние ${PERIOD_DAYS} дней`);
  const moodCount: Record<string, { n: number; sum: number }> = {};
  emotions.forEach((e: any) => { const m = (moodCount[e.mood] ??= { n: 0, sum: 0 }); m.n++; m.sum += e.intensity || 0; });
  table(['Настроение', 'Записей', 'Ср. интенсивность'],
    Object.entries(moodCount).sort((a, b) => b[1].n - a[1].n).map(([m, v]) => [MOOD_RU[m] ?? m, String(v.n), (v.sum / v.n).toFixed(1) + ' / 5']),
    [200, 120, W - 320]);
  const catCount: Record<string, { n: number; min: number }> = {};
  activities.forEach((a: any) => { const c = (catCount[a.category] ??= { n: 0, min: 0 }); c.n++; c.min += a.duration || 0; });
  table(['Активность', 'Раз', 'Минут всего'],
    Object.entries(catCount).sort((a, b) => b[1].n - a[1].n).map(([c, v]) => [CAT_RU[c] ?? c, String(v.n), String(v.min)]),
    [200, 120, W - 320]);

  // 5. Дневник
  heading('5. Последние записи дневника');
  bullets(diary.map((d: any) =>
    `${fmtDate(d.createdAt)} · ${TAG_RU[d.tag] ?? d.tag} · ${d.author?.role === 'trainer' ? 'тренер' : 'родитель'}${d.author?.name ? ` (${d.author.name})` : ''}: ${clip(d.text, 300)}`));

  // 6. Вехи развития
  heading('6. Вехи развития');
  const byDir: Record<string, { achieved: number; in_progress: number; not_yet: number }> = {};
  milestones.forEach((m: any) => {
    const dir = m.milestoneId?.direction ?? 'other';
    const row = (byDir[dir] ??= { achieved: 0, in_progress: 0, not_yet: 0 });
    row[m.status as 'achieved'] = (row[m.status as 'achieved'] ?? 0) + 1;
  });
  table(['Направление', 'Освоено', 'В процессе', 'Пока нет'],
    Object.entries(byDir).map(([d, v]) => [DIRECTION_RU[d] ?? d, String(v.achieved), String(v.in_progress), String(v.not_yet)]),
    [170, 100, 100, W - 370]);

  // 7. ИИ-скрининг
  heading('7. Последний ИИ-скрининг');
  if (screening?.result) {
    const r: any = screening.result;
    para(`от ${fmtDate(screening.createdAt)} · информационный характер, не является медицинским заключением`, { color: GRAY, size: 8.5 });
    para(r.summary);
    if (r.strengths?.length) { para('Сильные стороны:', { color: GRAY, size: 9 }); bullets(r.strengths); }
    if (r.attentionAreas?.length) {
      table(['Зона внимания', 'Уровень', 'Наблюдение'],
        r.attentionAreas.map((a: any) => [a.area, LEVEL_RU[a.level] ?? a.level, a.observation]), [130, 70, W - 200]);
    }
    if (r.risks?.length) { para('Риски:', { color: GRAY, size: 9 }); bullets(r.risks); }
    if (r.recommendationsTrainer?.length) { para('Рекомендации тренеру:', { color: GRAY, size: 9 }); bullets(r.recommendationsTrainer); }
    if (r.specialists?.length) { para('Специалисты:', { color: GRAY, size: 9 }); bullets(r.specialists.map((s: any) => `${s.specialist} — ${s.reason}`)); }
  } else {
    para('Скрининг ещё не проводился.', { color: GRAY });
  }

  // 8. ИИ-рекомендации
  heading('8. Последние ИИ-рекомендации родителю');
  if (rec?.content) {
    const c: any = rec.content;
    para(`от ${fmtDate((rec as any).generatedAt)}`, { color: GRAY, size: 8.5 });
    bullets([...(c.attentionPoints ?? []), ...(c.communicationTips ?? [])].slice(0, 8));
  } else {
    para('Рекомендации ещё не формировались.', { color: GRAY });
  }

  // 9. Документы
  heading('9. Документы');
  table(['Файл', 'Тип', 'Размер', 'Загружен'],
    docs.map((d: any) => [clip(d.fileName, 80), d.mimeType === 'application/pdf' ? 'PDF' : d.mimeType.includes('word') ? 'Word' : 'Фото',
      d.size ? `${Math.max(1, Math.round(d.size / 1024))} КБ` : '—', fmtDate(d.createdAt)]),
    [W - 230, 60, 70, 100]);

  // 10. Согласия
  heading('10. Действующие согласия законного представителя');
  table(['Согласие', 'Редакция', 'Дата'],
    consents
      .filter((c: any) => !c.childId || String(c.childId) === childId)
      .map((c: any) => [CONSENT_RU[c.type] ?? c.type, c.version, fmtDate(c.createdAt)]),
    [W - 200, 100, 100]);

  // Колонтитулы
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Колонтитул ниже нижнего поля: без обнуления поля pdfkit создаёт под него новую страницу
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 34;
    doc.font('regular').fontSize(7.5).fillColor(GRAY);
    doc.text(`UmaiSense · ${child.name} ${child.lastName ?? ''} · конфиденциально`, X, bottom, { width: W / 2, lineBreak: false });
    doc.text(`Стр. ${i - range.start + 1} из ${range.count}`, X + W / 2, bottom, { width: W / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  const buffer = await done;
  const safe = `${child.lastName ?? ''}_${child.name}`.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'child';
  return { buffer, fileName: `UmaiSense_отчёт_${safe}_${new Date().toISOString().slice(0, 10)}.pdf` };
};
