import { Response } from 'express';
import { AuthRequest } from '../types';
import Task from '../models/Task';
import TaskRating from '../models/TaskRating';
import Notification from '../models/Notification';
import User from '../models/User';
import Child from '../models/Child';

const getChildWithAccess = async (childId: string, userId?: string) => {
  const child = await Child.findById(childId);
  if (!child) return null;
  const hasAccess =
    child.parentId.toString() === userId ||
    child.trainers.some((t) => t.toString() === userId);
  return hasAccess ? child : null;
};

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const filter = isAdmin ? {} : { published: true };
    const tasks = await Task.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .select('-content');
    res.json(tasks);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const task = await Task.findById(req.params['id']);
    if (!task) { res.status(404).json({ message: 'Task not found' }); return; }
    if (!isAdmin && !task.published) { res.status(404).json({ message: 'Task not found' }); return; }
    res.json(task);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, content, coverImage, published } = req.body;

    const task = await Task.create({
      title,
      description,
      content,
      coverImage,
      published: !!published,
      publishedAt: published ? new Date() : undefined,
      author: req.user!.id,
    });

    if (published) {
      await notifyParents(task._id.toString(), title);
    }

    res.status(201).json(task);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, content, coverImage, published } = req.body;
    const task = await Task.findById(req.params['id']);
    if (!task) { res.status(404).json({ message: 'Task not found' }); return; }

    const wasUnpublished = !task.published;

    task.title       = title       ?? task.title;
    task.description = description ?? task.description;
    task.content      = content     ?? task.content;
    task.coverImage   = coverImage  ?? task.coverImage;
    task.published    = published   ?? task.published;

    if (published && wasUnpublished) {
      task.publishedAt = new Date();
      await notifyParents(task._id.toString(), task.title);
    }

    await task.save();
    res.json(task);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Task.findByIdAndDelete(req.params['id']);
    await TaskRating.deleteMany({ taskId: req.params['id'] });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTaskRatings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskId = req.params['id'];
    const userId = req.user?.id;
    const role = req.user?.role;

    let childIds: string[] = [];
    if (role === 'parent') {
      const children = await Child.find({ parentId: userId }).select('_id');
      childIds = children.map((c) => c._id.toString());
    } else if (role === 'trainer') {
      const children = await Child.find({ trainers: userId }).select('_id');
      childIds = children.map((c) => c._id.toString());
    } else {
      res.json([]);
      return;
    }

    const ratings = await TaskRating.find({ taskId, childId: { $in: childIds } });
    res.json(ratings);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const setTaskRating = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId, childId } = req.params;
    const { rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ message: 'Оценка должна быть целым числом от 1 до 5' });
      return;
    }

    const child = await getChildWithAccess(childId as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }

    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ message: 'Задание не найдено' });
      return;
    }

    const taskRating = await TaskRating.findOneAndUpdate(
      { taskId, childId },
      { rating: ratingNum, comment, ratedBy: req.user!.id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(taskRating);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

export const deleteTaskRating = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId, childId } = req.params;

    const child = await getChildWithAccess(childId as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }

    await TaskRating.findOneAndDelete({ taskId, childId });
    res.json({ message: 'Оценка удалена' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

const notifyParents = async (taskId: string, title: string): Promise<void> => {
  const parents = await User.find({ role: 'parent' }).select('_id');
  if (parents.length === 0) return;

  const notifications = parents.map((p) => ({
    userId:    p._id,
    type:      'new_task' as const,
    message:   `Новое задание: «${title}»`,
    relatedId: taskId,
    read:      false,
  }));

  await Notification.insertMany(notifications);
};
