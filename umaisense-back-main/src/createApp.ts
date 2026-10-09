import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'path';
import multer from 'multer';

import authRoutes from './routes/auth.routes';
import childrenRoutes from './routes/children.routes';
import invitesRoutes from './routes/invites.routes';
import emotionsRoutes from './routes/emotions.routes';
import activitiesRoutes from './routes/activities.routes';
import diaryRoutes from './routes/diary.routes';
import milestonesRoutes from './routes/milestones.routes';
import recommendationsRoutes from './routes/recommendations.routes';
import notificationsRoutes from './routes/notifications.routes';
import uploadRoutes from './routes/upload.routes';
import adminRoutes from './routes/admin.routes';
import articlesRoutes from './routes/articles.routes';
import documentsRoutes from './routes/documents.routes';
import tasksRoutes from './routes/tasks.routes';
import enrollmentRoutes from './routes/enrollment.routes';
import consentsRoutes from './routes/consents.routes';
import { seedMilestones } from './utils/seedMilestones';
import { seedAdmin } from './utils/seedAdmin';
import { createIndexes } from './utils/createIndexes';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _umaiSenseMongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global._umaiSenseMongoose ?? { conn: null, promise: null };
global._umaiSenseMongoose = cached;

/**
 * Подключение к MongoDB. Для продакшена в РК — набор реплик из 3 узлов;
 * w: 'majority' подтверждает запись только после копирования на большинство узлов,
 * поэтому падение одного узла не теряет данные.
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/umai_sense', {
        maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 20,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        retryWrites: true,
        w: 'majority',
      })
      .then(async (m) => {
        console.log('MongoDB connected');
        await seedMilestones();
        await seedAdmin();
        await createIndexes();
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
};

/** Отклоняем тела запросов с ключами-операторами MongoDB ($set, $ne, …) — защита от NoSQL-инъекций */
const hasMongoOperator = (v: unknown, depth = 0): boolean => {
  if (depth > 10 || v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some((x) => hasMongoOperator(x, depth + 1));
  return Object.entries(v as Record<string, unknown>).some(
    ([k, val]) => k.startsWith('$') || k.includes('.') || hasMongoOperator(val, depth + 1)
  );
};

export const createApp = () => {
  const app = express();

  // За балансировщиком/nginx: req.ip — реальный IP клиента (важно для лимитов и журнала доступа)
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.disable('x-powered-by');

  const allowedOrigins = [
    'https://umai-sense.netlify.app',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : []),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ];
  const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS !== 'false';

  app.use(
    helmet({
      // API отдаёт JSON; картинки из /uploads (только локальная разработка) должны грузиться с другого порта
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        let isAllowed = !origin || allowedOrigins.includes(origin);
        if (!isAllowed && allowVercelPreviews && origin) {
          try { isAllowed = /\.vercel\.app$/.test(new URL(origin).hostname); } catch { isAllowed = false; }
        }
        if (isAllowed) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (hasMongoOperator(req.body)) {
      res.status(400).json({ message: 'Некорректные данные запроса' });
      return;
    }
    next();
  });

  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // ─── Проверки здоровья (до подключения к БД — чтобы балансировщик видел реальное состояние) ───
  // live — процесс жив (перезапускать не нужно); ready — можно слать трафик (БД доступна)
  app.get('/api/health/live', (_req, res) => res.json({ status: 'ok' }));
  const ready = async (_req: Request, res: Response) => {
    try {
      await connectDB();
      await mongoose.connection.db?.admin().ping();
      res.json({ status: 'ok', db: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', db: 'unavailable' });
    }
  };
  app.get('/api/health', ready);
  app.get('/api/health/ready', ready);

  // Общий лимит запросов с одного IP (защита от перегрузки и перебора)
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: Number(process.env.RATE_LIMIT_PER_MINUTE) || 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Слишком много запросов. Подождите минуту.' },
    })
  );

  app.use(async (_req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error('DB connection error:', err);
      res.status(503).json({ message: 'Database unavailable' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/children', childrenRoutes);
  app.use('/api/invites', invitesRoutes);
  app.use('/api/emotions', emotionsRoutes);
  app.use('/api/activities', activitiesRoutes);
  app.use('/api/diary', diaryRoutes);
  app.use('/api/milestones', milestonesRoutes);
  app.use('/api/recommendations', recommendationsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/articles', articlesRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/enrollment', enrollmentRoutes);
  app.use('/api/consents', consentsRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

  // Единый обработчик ошибок: всегда JSON, без стектрейсов наружу
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой' : 'Ошибка загрузки файла' });
      return;
    }
    if (err?.message === 'Not allowed by CORS') {
      res.status(403).json({ message: 'Origin not allowed' });
      return;
    }
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ message: 'Слишком большой запрос' });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Некорректный JSON' });
      return;
    }
    if (typeof err?.message === 'string' && err.message.startsWith('Разрешены только')) {
      res.status(400).json({ message: err.message });
      return;
    }
    console.error('[error]', err);
    res.status(500).json({ message: 'Server error' });
  });

  return app;
};
