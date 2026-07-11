import mongoose from 'mongoose';
import type { IndexSpecification, CreateIndexesOptions } from 'mongodb';

/**
 * Creates MongoDB indexes for all collections.
 * Called once on server start — safe to call repeatedly (no-ops if indexes exist).
 */
export const createIndexes = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) return;

  const idx = async (collection: string, spec: IndexSpecification, options?: CreateIndexesOptions) => {
    try {
      await db.collection(collection).createIndex(spec, options);
    } catch {
      // index already exists or minor error — non-fatal
    }
  };

  // ─── Children ──────────────────────────────────────────────────────────────
  await idx('children', { parentId: 1 });
  await idx('children', { trainers: 1 });

  // ─── Emotions ──────────────────────────────────────────────────────────────
  await idx('emotions', { childId: 1, createdAt: -1 });

  // ─── Activities ────────────────────────────────────────────────────────────
  await idx('activities', { childId: 1, date: -1 });
  await idx('activities', { childId: 1, category: 1 });

  // ─── Diary entries ─────────────────────────────────────────────────────────
  await idx('diaryentries', { childId: 1, createdAt: -1 });
  await idx('diaryentries', { childId: 1, tag: 1 });
  await idx('diaryentries', { childId: 1, author: 1 });

  // ─── Notifications ─────────────────────────────────────────────────────────
  await idx('notifications', { userId: 1, createdAt: -1 });
  await idx('notifications', { userId: 1, read: 1 });

  // ─── Child milestones ──────────────────────────────────────────────────────
  await idx('childmilestones', { childId: 1 });
  await idx('childmilestones', { childId: 1, milestoneId: 1 }, { unique: true });

  // ─── Recommendations ───────────────────────────────────────────────────────
  await idx('recommendations', { childId: 1, generatedAt: -1 });

  // ─── Articles ──────────────────────────────────────────────────────────────
  await idx('articles', { published: 1, publishedAt: -1 });

  // ─── Invite codes ──────────────────────────────────────────────────────────
  await idx('invitecodes', { code: 1 }, { unique: true });
  await idx('invitecodes', { expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL — auto-delete expired codes

  // ─── Milestones ────────────────────────────────────────────────────────────
  await idx('milestones', { direction: 1, ageGroup: 1 });

  console.log('[DB] Indexes created');
};
