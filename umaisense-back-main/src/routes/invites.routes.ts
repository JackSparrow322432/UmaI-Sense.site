import { Router } from 'express';
import { createInvite, useInvite } from '../controllers/invites.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

// Тренеров к детям теперь записывает только администратор (см. /api/enrollment).
// Старый механизм кодов от родителя закрыт.
router.post('/create', adminOnly, createInvite);
// Устаревший эндпоинт: раньше его мог вызвать ЛЮБОЙ авторизованный пользователь (даже родитель)
// и подбором кода получить доступ к чужому ребёнку. Доступ тренера теперь даёт только
// /api/enrollment/trainer/activate (код привязан к конкретному тренеру).
router.post('/use', (_req, res) => {
  res.status(410).json({ message: 'Этот способ доступа больше не поддерживается. Используйте код от администратора в разделе «Дети».' });
});
void useInvite;

export default router;
