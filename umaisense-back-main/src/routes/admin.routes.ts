import { Router } from 'express';
import { getUsers, getUserDetail, getChildDetail, getChildAudit, setAdminRole, downloadChildReport } from '../controllers/admin.controller';
import { Types } from 'mongoose';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { getSummaryStatus, createSummary, listSummaries, getSummary, downloadSummaryPdf } from '../controllers/adminSummary.controller';

const router = Router();

router.use(protect, adminOnly);

router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/admin', setAdminRole);
router.param('childId', (_req, res, next, value) => {
  if (!Types.ObjectId.isValid(value)) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
  next();
});
router.param('id', (_req, res, next, value) => {
  if (!Types.ObjectId.isValid(value)) { res.status(400).json({ message: 'Некорректный идентификатор' }); return; }
  next();
});

router.get('/children/:childId', getChildDetail);
router.get('/children/:childId/audit', getChildAudit);
router.get('/children/:childId/report.pdf', downloadChildReport);
// ИИ-сводка по ребёнку (профиль + документы + наблюдения) и её PDF
router.get('/children/:childId/ai-summary/status', getSummaryStatus);
router.get('/children/:childId/ai-summary', listSummaries);
router.post('/children/:childId/ai-summary', createSummary);
router.get('/children/:childId/ai-summary/:summaryId', getSummary);
router.get('/children/:childId/ai-summary/:summaryId/pdf', downloadSummaryPdf);

export default router;
