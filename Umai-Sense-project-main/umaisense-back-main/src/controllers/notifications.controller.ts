import { Response } from 'express';
import { AuthRequest } from '../types';
import Notification from '../models/Notification';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { read: true }
    );
    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.user!.id, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
