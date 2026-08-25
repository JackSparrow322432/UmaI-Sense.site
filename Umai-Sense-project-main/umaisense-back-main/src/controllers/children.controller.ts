import { Response } from 'express';
import { AuthRequest } from '../types';
import Child from '../models/Child';
import { Types } from 'mongoose';

// GET /api/children
export const getChildren = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new Types.ObjectId(req.user?.id);
    const query =
      req.user?.role === 'parent'
        ? { parentId: userId }
        : { trainers: userId };

    const children = await Child.find(query).populate('trainers', 'name phone photo');
    res.json(children);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/children/:id
export const getChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findById(req.params.id).populate('trainers', 'name phone photo');
    if (!child) {
      res.status(404).json({ message: 'Child not found' });
      return;
    }
    const userId = req.user?.id;
    const hasAccess =
      child.parentId.toString() === userId ||
      child.trainers.some((t: any) => t._id.toString() === userId);

    if (!hasAccess) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    res.json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/children
export const createChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.create({ ...req.body, parentId: req.user?.id, trainers: [] });
    res.status(201).json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/children/:id
export const updateChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findOneAndUpdate(
      { _id: req.params.id, parentId: req.user?.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    res.json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/children/:id
export const deleteChild = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findOneAndDelete({ _id: req.params.id, parentId: req.user?.id });
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    res.json({ message: 'Child deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/children/:id/trainers/:trainerId
export const removeTrainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await Child.findOneAndUpdate(
      { _id: req.params.id, parentId: req.user?.id },
      { $pull: { trainers: new Types.ObjectId(req.params['trainerId'] as string) } },
      { new: true }
    );
    if (!child) {
      res.status(404).json({ message: 'Child not found or access denied' });
      return;
    }
    res.json(child);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};
