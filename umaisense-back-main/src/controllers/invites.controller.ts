import { Response } from 'express';
import { AuthRequest } from '../types';
import InviteCode from '../models/InviteCode';
import Child from '../models/Child';
import Notification from '../models/Notification';
import { generateInviteCode } from '../utils/generateToken';
import { Types } from 'mongoose';

// POST /api/invites/create
export const createInvite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { childId } = req.body;

    const child = await Child.findOne({ _id: childId, parentId: req.user?.id });
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }

    // Invalidate old codes for this child
    await InviteCode.deleteMany({ childId, used: false });

    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const invite = await InviteCode.create({
      code,
      childId,
      parentId: req.user?.id,
      expiresAt,
    });

    res.status(201).json(invite);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/invites/use
export const useInvite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    const invite = await InviteCode.findOne({ code, used: false });
    if (!invite || invite.expiresAt < new Date()) {
      res.status(400).json({ message: 'Invalid or expired invite code' });
      return;
    }

    const child = await Child.findById(invite.childId);
    if (!child) {
      res.status(404).json({ message: 'Child not found' });
      return;
    }

    const trainerId = new Types.ObjectId(req.user?.id);
    if (!child.trainers.some((t) => t.toString() === trainerId.toString())) {
      child.trainers.push(trainerId);
      await child.save();
    }

    invite.used = true;
    invite.usedBy = trainerId;
    await invite.save();

    // Notify parent
    await Notification.create({
      userId: invite.parentId,
      type: 'invite_accepted',
      message: `Тренер принял приглашение для ребёнка ${child.name}`,
      relatedId: child._id,
    });

    res.json({ message: 'Access granted', child });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
