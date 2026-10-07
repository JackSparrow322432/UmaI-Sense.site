import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';
import Child from '../models/Child';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import AuditLog from '../models/AuditLog';
import { logAccess } from '../utils/audit';

// GET /api/admin/users — все пользователи, включая администраторов
export const getUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
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
    await logAccess(req, { action: 'child.view', childId: child._id });

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

// GET /api/admin/children/:childId/audit — журнал доступа к данным ребёнка
export const getChildAudit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entries = await AuditLog.find({ childId: req.params['childId'] })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json(entries);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/users/:id/admin  { isAdmin: boolean }
// Назначить пользователя администратором или снять права. Публичной регистрации админа нет —
// новых администраторов назначает только действующий администратор.
export const setAdminRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.body?.isAdmin;
    if (typeof isAdmin !== 'boolean') {
      res.status(400).json({ message: 'Укажите isAdmin: true или false' });
      return;
    }
    const user = await User.findById(req.params['id']);
    if (!user) { res.status(404).json({ message: 'Пользователь не найден' }); return; }

    if (isAdmin) {
      if (user.role === 'admin') { res.json(user); return; }
      if (!user.isVerified) {
        res.status(400).json({ message: 'Пользователь не подтвердил email — назначить администратором нельзя' });
        return;
      }
      user.formerRole = user.role as 'parent' | 'trainer';
      user.role = 'admin';
      await user.save();
      await logAccess(req, { action: 'admin.grant', meta: { targetUserId: String(user._id), email: user.email } });
      res.json(user);
      return;
    }

    if (user.role !== 'admin') { res.json(user); return; }
    if (String(user._id) === req.user?.id) {
      res.status(400).json({ message: 'Нельзя снять права администратора с самого себя' });
      return;
    }
    const admins = await User.countDocuments({ role: 'admin' });
    if (admins <= 1) {
      res.status(400).json({ message: 'Должен остаться хотя бы один администратор' });
      return;
    }
    user.role = user.formerRole ?? 'parent';
    user.formerRole = undefined;
    await user.save();
    await logAccess(req, { action: 'admin.revoke', meta: { targetUserId: String(user._id), email: user.email } });
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
