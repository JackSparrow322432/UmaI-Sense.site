import { Router } from 'express';
import { getArticles, getArticle, createArticle, updateArticle, deleteArticle } from '../controllers/articles.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/',    getArticles);
router.get('/:id', getArticle);
router.post('/',         adminOnly, createArticle);
router.put('/:id',       adminOnly, updateArticle);
router.delete('/:id',    adminOnly, deleteArticle);

export default router;
