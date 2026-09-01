import { Response } from 'express';
import { AuthRequest } from '../types';
import DiaryEntry from '../models/DiaryEntry';
import Child from '../models/Child';
import Notification from '../models/Notification';

const hasChildAccess = async (childId: string, userId: string) => {
  const child = await Child.findById(childId);
  if (!child) return { access: false, child: null };
  const access =
    child.parentId.toString() === userId ||
    child.trainers.some((t) => t.toString() === userId);
  return { access, child };
};

export const getDiaryEntries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    const { access } = await hasChildAccess(childId, req.user!.id);
    if (!access) { res.status(403).json({ message: 'Access denied' }); return; }

    const { tag, author } = req.query;
    const filter: Record<string, unknown> = { childId };
    if (tag) filter['tag'] = tag as string;
    if (author) filter['author'] = author as string;

    const entries = await DiaryEntry.find(filter)
      .sort({ createdAt: -1 })
      .populate('author', 'name role');
    res.json(entries);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addDiaryEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    const { access, child } = await hasChildAccess(childId, req.user!.id);
    if (!access || !child) { res.status(403).json({ message: 'Access denied' }); return; }

    const entry = await DiaryEntry.create({ ...req.body, childId, author: req.user!.id });

    if (req.user!.role === 'trainer') {
      await Notification.create({
        userId: child.parentId,
        type: 'diary_entry',
        message: `Тренер добавил запись в дневник наблюдений ребёнка ${child.name}`,
        relatedId: entry._id,
      });
    }

    res.status(201).json(entry);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteDiaryEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    const entryId = req.params['entryId'] as string;
    await DiaryEntry.findOneAndDelete({ _id: entryId, childId, author: req.user!.id });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
