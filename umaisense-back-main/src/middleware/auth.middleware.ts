import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import { getJwtSecret } from '../utils/env';
import User from '../models/User';

interface JwtPayload {
  id: string;
  role: 'parent' | 'trainer' | 'admin';
  iat?: number;
}

/**
 * Проверка токена + актуальной роли из базы. Роль в токене может устареть (например,
 * администратора лишили прав или аккаунт удалён) — поэтому права берутся из базы
 * на каждый запрос.
 */
export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }

  const token = authHeader.split(' ')[1];

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  try {
    const user = await User.findById(decoded.id).select('role passwordChangedAt').lean();
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    // Токен выдан до смены пароля — недействителен (украденный токен перестаёт работать после сброса)
    if (user.passwordChangedAt && decoded.iat && decoded.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      res.status(401).json({ message: 'Session expired' });
      return;
    }
    req.user = { id: decoded.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

export const parentOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'parent') {
    res.status(403).json({ message: 'Access denied: parents only' });
    return;
  }
  next();
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Access denied: admins only' });
    return;
  }
  next();
};

export const trainerOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'trainer') {
    res.status(403).json({ message: 'Access denied: trainers only' });
    return;
  }
  next();
};
