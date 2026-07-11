import { Response } from 'express';
import { AuthRequest } from '../types';
import { Milestone, ChildMilestone } from '../models/Milestone';
import Child from '../models/Child';

export const getMilestones = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const milestones = await Milestone.find().sort({ ageGroup: 1, direction: 1 });
    res.json(milestones);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getChildMilestones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findById(req.params.childId);
    if (!child) { res.status(404).json({ message: 'Child not found' }); return; }

    const hasAccess =
      child.parentId.toString() === req.user!.id ||
      child.trainers.some((t) => t.toString() === req.user!.id);
    if (!hasAccess) { res.status(403).json({ message: 'Access denied' }); return; }

    const childMilestones = await ChildMilestone.find({ childId: req.params.childId })
      .populate('milestoneId');
    res.json(childMilestones);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateChildMilestone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const record = await ChildMilestone.findOneAndUpdate(
      { childId: req.params.childId, milestoneId: req.params.milestoneId },
      { status, updatedBy: req.user!.id },
      { new: true, upsert: true }
    );
    res.json(record);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
