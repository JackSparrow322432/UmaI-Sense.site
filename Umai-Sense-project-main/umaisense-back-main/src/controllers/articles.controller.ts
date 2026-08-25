import { Response } from 'express';
import { AuthRequest } from '../types';
import Article from '../models/Article';
import Notification from '../models/Notification';
import User from '../models/User';

// GET /api/articles — published only for users, all for admin
export const getArticles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const filter = isAdmin ? {} : { published: true };
    const articles = await Article.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .select('-content'); // list view: no full content
    res.json(articles);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/articles/:id
export const getArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const article = await Article.findById(req.params['id']);
    if (!article) { res.status(404).json({ message: 'Article not found' }); return; }
    if (!isAdmin && !article.published) { res.status(404).json({ message: 'Article not found' }); return; }
    res.json(article);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/articles — admin only
export const createArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, excerpt, content, coverImage, published } = req.body;

    const article = await Article.create({
      title,
      excerpt,
      content,
      coverImage,
      published: !!published,
      publishedAt: published ? new Date() : undefined,
      author: req.user!.id,
    });

    if (published) {
      await notifyParents(article._id.toString(), title);
    }

    res.status(201).json(article);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/articles/:id — admin only
export const updateArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, excerpt, content, coverImage, published } = req.body;
    const article = await Article.findById(req.params['id']);
    if (!article) { res.status(404).json({ message: 'Article not found' }); return; }

    const wasUnpublished = !article.published;

    article.title       = title       ?? article.title;
    article.excerpt     = excerpt     ?? article.excerpt;
    article.content     = content     ?? article.content;
    article.coverImage  = coverImage  ?? article.coverImage;
    article.published   = published   ?? article.published;

    // Set publishedAt only when first publishing
    if (published && wasUnpublished) {
      article.publishedAt = new Date();
      await notifyParents(article._id.toString(), article.title);
    }

    await article.save();
    res.json(article);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/articles/:id — admin only
export const deleteArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Article.findByIdAndDelete(req.params['id']);
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Helper: notify all parents ───────────────────────────────────────────────

const notifyParents = async (articleId: string, title: string): Promise<void> => {
  const parents = await User.find({ role: 'parent' }).select('_id');
  if (parents.length === 0) return;

  const notifications = parents.map((p) => ({
    userId:    p._id,
    type:      'new_article' as const,
    message:   `Новая статья: «${title}»`,
    relatedId: articleId,
    read:      false,
  }));

  await Notification.insertMany(notifications);
};
