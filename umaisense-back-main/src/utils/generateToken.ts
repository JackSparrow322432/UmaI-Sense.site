import jwt from 'jsonwebtoken';
import { getJwtSecret } from './env';

export const generateToken = (id: string, role: 'parent' | 'trainer' | 'admin'): string => {
  return jwt.sign({ id, role }, getJwtSecret(), { expiresIn: '30d' });
};

export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'UMS-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};
