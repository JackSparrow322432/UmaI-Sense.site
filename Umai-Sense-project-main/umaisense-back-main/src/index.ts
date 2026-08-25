import 'dotenv/config';
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
import { seedMilestones } from './utils/seedMilestones';
import { seedAdmin } from './utils/seedAdmin';
import { createIndexes } from './utils/createIndexes';

const app = express();

// Middleware
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
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Connect DB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/umai_sense')
  .then(async () => {
    console.log('MongoDB connected');
    await seedMilestones();
    await seedAdmin();
    await createIndexes();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err: Error) => {
    console.error('DB connection error:', err.message);
    process.exit(1);
  });
