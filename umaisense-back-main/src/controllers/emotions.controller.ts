import { Response } from 'express';
import { AuthRequest } from '../types';
import Emotion from '../models/Emotion';
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

export const getEmotions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    if (!(await hasChildAccess(childId, req.user!.id))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const emotions = await Emotion.find({ childId })
      .sort({ createdAt: -1 })
      .populate('recordedBy', 'name role');
    res.json(emotions);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addEmotion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    if (!(await hasChildAccess(childId, req.user!.id))) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    // Только разрешённые поля: ...req.body позволял подставить createdAt и любые лишние поля
    const { mood, intensity, comment } = req.body ?? {};
    const emotion = await Emotion.create({
      mood,
      intensity,
      comment: typeof comment === 'string' ? comment.slice(0, 2000) : undefined,
      childId,
      recordedBy: req.user!.id,
    });
    res.status(201).json(emotion);
  } catch (err: any) {
    if (err?.name === 'ValidationError') { res.status(400).json({ message: 'Некорректные данные' }); return; }
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteEmotion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const childId = req.params['childId'] as string;
    const emotionId = req.params['emotionId'] as string;
    await Emotion.findOneAndDelete({ _id: emotionId, childId, recordedBy: req.user!.id });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
