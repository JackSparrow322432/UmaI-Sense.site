import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';

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
import { seedMilestones } from './utils/seedMilestones';
import { seedAdmin } from './utils/seedAdmin';
import { createIndexes } from './utils/createIndexes';

// Vercel-версия приложения из index.ts: то же самое, но без app.listen() —
// Vercel сам вызывает экспортированный app как обработчик запроса.
// index.ts не менялся и по-прежнему работает для локальной разработки.

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

const connectDB = async (): Promise<typeof mongoose> => {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/umai_sense')
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

export const createApp = () => {
  const app = express();

  const allowedOrigins = [
    'https://umai-sense.netlify.app',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        const isAllowed =
          !origin ||
          allowedOrigins.includes(origin) ||
          /\.vercel\.app$/.test(new URL(origin).hostname);
        if (isAllowed) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  return app;
};
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  return app;
};
