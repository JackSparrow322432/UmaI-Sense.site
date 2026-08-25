import { Response } from 'express';
import { AuthRequest } from '../types';
import Activity from '../models/Activity';
import Child from '../models/Child';

const hasChildAccess = async (childId: string, userId: string): Promise<boolean> => {
  const child = await Child.findById(childId);
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
    const activity = await Activity.create({ ...req.body, childId, recordedBy: req.user!.id });
    res.status(201).json(activity);
  } catch {
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
