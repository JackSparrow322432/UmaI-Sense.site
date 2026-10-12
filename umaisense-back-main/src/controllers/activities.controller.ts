import { Response } from 'express';
import { AuthRequest } from '../types';
import Activity from '../models/Activity';
import Child from '../models/Child';
import { Types } from 'mongoose';

const hasChildAccess = async (childId: string, userId: string): Promise<boolean> => {
  // Некорректный id → просто «нет доступа», а не 500 от CastError
  if (!Types.ObjectId.isValid(childId)) return false;
  const child = await Child.findById(childId).select('parentId trainers');
  if (!child) return false;
  return (
    child.parentId.toString() === userId ||
    child.trainers.some((t) => t.toString() === userId)
  );
};

export const getActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    if (!(await hasChildAccess(childId, req.user!.id))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const { category } = req.query;
    const filter: Record<string, unknown> = { childId };
    if (category) filter['category'] = category as string;

    const activities = await Activity.find(filter)
      .sort({ date: -1 })
      .populate('recordedBy', 'name role');
    res.json(activities);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    if (!(await hasChildAccess(childId, req.user!.id))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    // Только разрешённые поля (раньше ...req.body пропускал всё подряд)
    const { name, category, date, duration, notes } = req.body ?? {};
    const activity = await Activity.create({
      name: typeof name === 'string' ? name.slice(0, 200) : name,
      category,
      date,
      duration,
      notes: typeof notes === 'string' ? notes.slice(0, 2000) : undefined,
      childId,
      recordedBy: req.user!.id,
    });
    res.status(201).json(activity);
  } catch (err: any) {
    if (err?.name === 'ValidationError') { res.status(400).json({ message: 'Некорректные данные' }); return; }
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    const activityId = req.params['activityId'] as string;
    await Activity.findOneAndDelete({ _id: activityId, childId, recordedBy: req.user!.id });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
