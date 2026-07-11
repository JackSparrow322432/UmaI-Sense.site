import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../types';
import User from '../models/User';
import OtpCode from '../models/OtpCode';
import { generateToken } from '../utils/generateToken';
import { sendOtpEmail } from '../utils/sendEmail';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// POST /api/auth/send-otp  — registration only
export const sendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      res.status(400).json({ message: 'Email и роль обязательны' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'Некорректный email' });
      return;
    }
    if (!['parent', 'trainer'].includes(role)) {
      res.status(400).json({ message: 'Неверная роль' });
      return;
    }

    // Block if already registered
    const existing = await User.findOne({ email }).select('+password');
    if (existing?.password) {
      res.status(400).json({ message: 'Аккаунт уже существует. Войдите через пароль.' });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpCode.deleteMany({ email });
    await OtpCode.create({ email, code, expiresAt });

    if (process.env.NODE_ENV === 'production') {
      await sendOtpEmail(email, code);
    } else {
      console.log(`[DEV] OTP for ${email}: ${code}`);
    }

    res.json({
      message: 'Код отправлен на почту',
      ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
    });
  } catch (err) {
    console.error('sendOtp error:', err);
    res.status(500).json({ message: 'Ошибка отправки кода' });
  }
};

// POST /api/auth/resend-otp
export const resendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ message: 'Некорректный email' });
      return;
    }

    const existing = await OtpCode.findOne({ email });
    if (existing) {
      const secondsLeft = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000);
      if (secondsLeft > 240) {
        res.status(429).json({ message: `Подождите ${secondsLeft - 240} сек.` });
        return;
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpCode.deleteMany({ email });
    await OtpCode.create({ email, code, expiresAt });

    if (process.env.NODE_ENV === 'production') {
      await sendOtpEmail(email, code);
    } else {
      console.log(`[DEV] Resend OTP for ${email}: ${code}`);
    }

    res.json({
      message: 'Код отправлен повторно',
      ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
    });
  } catch {
    res.status(500).json({ message: 'Ошибка отправки кода' });
  }
};

// POST /api/auth/verify-otp  — just verifies email, no JWT yet
export const verifyOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ message: 'Email и код обязательны' });
      return;
    }

    const otp = await OtpCode.findOne({ email, code });
    if (!otp || otp.expiresAt < new Date()) {
      res.status(400).json({ message: 'Неверный или истёкший код' });
      return;
    }

    await OtpCode.deleteMany({ email });

    res.json({ verified: true, email });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/auth/complete-registration  — set name + password after OTP
export const completeRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, name, password, role } = req.body;

    if (!email || !name || !password || !role) {
      res.status(400).json({ message: 'Все поля обязательны' });
      return;
    }
    if (name.trim().length < 2) {
      res.status(400).json({ message: 'Имя слишком короткое' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов' });
      return;
    }

    const existing = await User.findOne({ email }).select('+password');
    if (existing?.password) {
      res.status(400).json({ message: 'Аккаунт уже зарегистрирован. Войдите через пароль.' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);

    let user = existing;
    if (user) {
      user.name = name.trim();
      user.password = hashed;
      user.isVerified = true;
      user.role = role;
      await user.save();
    } else {
      user = await User.create({ email, name: name.trim(), password: hashed, role, isVerified: true });
    }

    const token = generateToken(user._id.toString(), user.role);
    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({ token, user: userObj });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/auth/login  — email + password
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email и пароль обязательны' });
      return;
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      res.status(401).json({ message: 'Аккаунт не найден. Зарегистрируйтесь.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ message: 'Неверный пароль' });
      return;
    }

    const token = generateToken(user._id.toString(), user.role);
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ token, user: userObj });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ message: 'Некорректный email' });
      return;
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      // Don't reveal whether account exists
      res.json({ message: 'Если аккаунт существует, код отправлен на почту' });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpCode.deleteMany({ email });
    await OtpCode.create({ email, code, expiresAt });

    if (process.env.NODE_ENV === 'production') {
      await sendOtpEmail(email, code);
    } else {
      console.log(`[DEV] Reset OTP for ${email}: ${code}`);
    }

    res.json({
      message: 'Если аккаунт существует, код отправлен на почту',
      ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
    });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      res.status(400).json({ message: 'Все поля обязательны' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов' });
      return;
    }

    const otp = await OtpCode.findOne({ email, code });
    if (!otp || otp.expiresAt < new Date()) {
      res.status(400).json({ message: 'Неверный или истёкший код' });
      return;
    }

    await OtpCode.deleteMany({ email });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashed });

    res.json({ message: 'Пароль успешно изменён' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('-__v');
    if (!user) { res.status(404).json({ message: 'Пользователь не найден' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// PUT /api/auth/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, photo } = req.body;
    if (!name || name.trim().length < 2) {
      res.status(400).json({ message: 'Имя слишком короткое' });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { name: name.trim(), photo },
      { new: true }
    ).select('-__v');
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// DELETE /api/auth/account
export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndDelete(req.user?.id);
    res.json({ message: 'Аккаунт удалён' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
