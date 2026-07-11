import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';
import Child from '../models/Child';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';

// GET /api/admin/users
export const getUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/users/:id
export const getUserDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params['id']);
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    let children: any[] = [];

    if (user.role === 'parent') {
      children = await Child.find({ parentId: user._id })
        .select('name dateOfBirth photo diagnosis createdAt')
        .sort({ createdAt: -1 });
    }

    if (user.role === 'trainer') {
      children = await Child.find({ trainers: user._id })
        .select('name dateOfBirth photo diagnosis parentId createdAt')
        .populate('parentId', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json({ user, children });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/children/:childId
export const getChildDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findById(req.params['childId'])
      .populate('parentId', 'name email')
      .populate('trainers', 'name email');

    if (!child) { res.status(404).json({ message: 'Child not found' }); return; }

    const [emotions, activities, diary] = await Promise.all([
      Emotion.find({ childId: child._id })
        .populate('recordedBy', 'name role')
        .sort({ createdAt: -1 })
        .limit(10),
      Activity.find({ childId: child._id })
        .populate('recordedBy', 'name role')
        .sort({ date: -1 })
        .limit(10),
      DiaryEntry.find({ childId: child._id })
        .populate('author', 'name role')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const stats = {
      totalEmotions:   await Emotion.countDocuments({ childId: child._id }),
      totalActivities: await Activity.countDocuments({ childId: child._id }),
      totalDiary:      await DiaryEntry.countDocuments({ childId: child._id }),
    };

    res.json({ child, emotions, activities, diary, stats });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
