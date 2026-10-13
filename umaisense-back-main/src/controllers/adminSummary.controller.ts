import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../types';
import AdminSummary from '../models/AdminSummary';
import { logAccess } from '../utils/audit';
import {
  summaryStatus, generateAdminSummary, buildAdminSummaryPdf, AdminSummaryError,
} from '../utils/adminSummary';

/** ИИ-сводка по ребёнку — только администратор (routes/admin.routes.ts: protect + adminOnly) */

const fail = (res: Response, err: unknown, fallback: string) => {
  if (err instanceof AdminSummaryError) {
    res.status(err.status).json({ message: err.message, ...err.extra });
    return;
  }
  console.error('[admin-summary]', (err as Error)?.message ?? err);
  res.status(500).json({ message: fallback });
};

// GET /api/admin/children/:childId/ai-summary/status
export const getSummaryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await summaryStatus(String(req.params['childId'])));
  } catch (err) {
    fail(res, err, 'Server error');
  }
};

// POST /api/admin/children/:childId/ai-summary
export const createSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = String(req.params['childId']);
    const summary = await generateAdminSummary(childId, String(req.user!.id));
    await logAccess(req, { action: 'child.ai_summary', childId, meta: { summaryId: String(summary._id) } });
    res.status(201).json(summary);
  } catch (err) {
    fail(res, err, 'Не удалось сформировать сводку');
  }
};

// GET /api/admin/children/:childId/ai-summary — история (без полного результата)
export const listSummaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await AdminSummary.find({ childId: req.params['childId'] })
      .sort({ createdAt: -1 }).limit(50)
      .select('status createdAt createdBy error inputSummary.documentsUsed inputSummary.documentsTotal result.overview')
      .populate('createdBy', 'name email')
      .lean();
    res.json(items);
  } catch (err) {
    fail(res, err, 'Server error');
  }
};

const findOwn = async (req: AuthRequest) => {
  const id = String(req.params['summaryId']);
  if (!Types.ObjectId.isValid(id)) return null;
  return AdminSummary.findOne({ _id: id, childId: req.params['childId'] }).populate('createdBy', 'name email');
};

// GET /api/admin/children/:childId/ai-summary/:summaryId
export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const s = await findOwn(req);
    if (!s) { res.status(404).json({ message: 'Сводка не найдена' }); return; }
    res.json(s);
  } catch (err) {
    fail(res, err, 'Server error');
  }
};

// GET /api/admin/children/:childId/ai-summary/:summaryId/pdf
export const downloadSummaryPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const s = await findOwn(req);
    if (!s) { res.status(404).json({ message: 'Сводка не найдена' }); return; }
    const { buffer, fileName } = await buildAdminSummaryPdf(String(s._id));
    await logAccess(req, { action: 'child.ai_summary_pdf', childId: String(req.params['childId']), meta: { summaryId: String(s._id) } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="UmaiSense_ai_summary.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    fail(res, err, 'Не удалось сформировать PDF');
  }
};
