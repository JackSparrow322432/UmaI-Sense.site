import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../types';
import User from '../models/User';
import OtpCode from '../models/OtpCode';
import { generateToken } from '../utils/generateToken';
import { sendOtpEmail } from '../utils/sendEmail';
import { cancelEnrollmentForDeletedUser } from './enrollment.controller';
import { randomInt, randomBytes, createHash, timingSafeEqual } from 'crypto';
import { recordConsent } from '../utils/consent';
import Child from '../models/Child';
import { purgeChildData } from '../utils/purgeChild';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_TTL_MS = 15 * 60 * 1000;
const MIN_PASSWORD = 8;

// Всё, что приходит из тела запроса, приводим к строке: иначе объект вида
// {"$ne": ""} превратился бы в Mongo-оператор и подошёл бы к любому коду (NoSQL-инъекция).
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const normEmail = (v: unknown): string => str(v).toLowerCase();

const newCode = () => randomInt(100000, 1000000).toString();
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const issueOtp = async (email: string, purpose: 'register' | 'reset'): Promise<string> => {
  const code = newCode();
  await OtpCode.deleteMany({ email });
  await OtpCode.create({ email, code, purpose, expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  return code;
};

const deliverOtp = async (email: string, code: string, label: string) => {
  if (process.env.NODE_ENV === 'production') {
    await sendOtpEmail(email, code);
  } else {
    console.log(`[DEV] ${label} OTP for ${email}: ${code}`);
  }
};

/**
 * Проверка кода с ограничением попыток. Возвращает документ кода или текст ошибки.
 */
const checkOtp = async (email: string, code: string, purpose: 'register' | 'reset') => {
  const otp = await OtpCode.findOne({ email, purpose });
  if (!otp || otp.expiresAt < new Date()) return { error: 'Неверный или истёкший код' } as const;
  if (otp.code !== code) {
    otp.attempts += 1;
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await otp.deleteOne();
      return { error: 'Слишком много неверных попыток. Запросите новый код.' } as const;
    }
    await otp.save();
    return { error: 'Неверный или истёкший код' } as const;
  }
  return { otp } as const;
};

// POST /api/auth/send-otp  — registration only
export const sendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = normEmail(req.body?.email);
    const role = str(req.body?.role);

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

    const existing = await User.findOne({ email }).select('+password');
    if (existing?.password) {
      res.status(400).json({ message: 'Аккаунт уже существует. Войдите через пароль.' });
      return;
    }

    const code = await issueOtp(email, 'register');
    await deliverOtp(email, code, 'Register');

    res.json({
      message: 'Код отправлен на почту',
      ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
    });
  } catch (err) {
    console.error('sendOtp error:', err);
    res.status(500).json({ message: 'Ошибка отправки кода' });
  }
};

// POST /api/auth/resend-otp  — повторная отправка кода регистрации
export const resendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = normEmail(req.body?.email);
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

    const user = await User.findOne({ email }).select('+password');
    if (user?.password) {
      res.status(400).json({ message: 'Аккаунт уже существует. Войдите через пароль.' });
      return;
    }

    const code = await issueOtp(email, 'register');
    await deliverOtp(email, code, 'Resend');

    res.json({
      message: 'Код отправлен повторно',
      ...(process.env.NODE_ENV !== 'production' && { dev_code: code }),
    });
  } catch {
    res.status(500).json({ message: 'Ошибка отправки кода' });
  }
};

// POST /api/auth/verify-otp  — подтверждает email; без этого шага регистрация невозможна
export const verifyOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = normEmail(req.body?.email);
    const code = str(req.body?.code);

    if (!email || !code) {
      res.status(400).json({ message: 'Email и код обязательны' });
      return;
    }

    const result = await checkOtp(email, code, 'register');
    if ('error' in result) {
      res.status(400).json({ message: result.error });
      return;
    }

    const registrationToken = randomBytes(32).toString('hex');
    result.otp.verified = true;
    result.otp.registrationTokenHash = sha256(registrationToken);
    result.otp.expiresAt = new Date(Date.now() + VERIFIED_TTL_MS);
    await result.otp.save();

    res.json({ verified: true, email, registrationToken });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/auth/complete-registration  — имя + пароль после подтверждения email
export const completeRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = normEmail(req.body?.email);
    const name = str(req.body?.name);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = str(req.body?.role);

    if (!email || !name || !password || !role) {
      res.status(400).json({ message: 'Все поля обязательны' });
      return;
    }
    // Администратора нельзя зарегистрировать через публичную форму
    if (!['parent', 'trainer'].includes(role)) {
      res.status(400).json({ message: 'Неверная роль' });
      return;
    }
    if (name.length < 2) {
      res.status(400).json({ message: 'Имя слишком короткое' });
      return;
    }
    if (password.length < MIN_PASSWORD) {
      res.status(400).json({ message: `Пароль должен содержать минимум ${MIN_PASSWORD} символов` });
      return;
    }
    if (req.body?.consent !== true) {
      res.status(400).json({ message: 'Необходимо согласие на сбор и обработку персональных данных' });
      return;
    }

    // Email должен быть подтверждён кодом (verify-otp) не более 15 минут назад
    const registrationToken = str(req.body?.registrationToken);
    const otp = await OtpCode.findOne({ email, purpose: 'register', verified: true });
    if (
      !otp || otp.expiresAt < new Date() || !otp.registrationTokenHash || !registrationToken ||
      !sameHash(otp.registrationTokenHash, sha256(registrationToken))
    ) {
      res.status(400).json({ message: 'Подтвердите email кодом из письма' });
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
      user.name = name;
      user.password = hashed;
      user.isVerified = true;
      user.role = role as 'parent' | 'trainer';
      await user.save();
    } else {
      user = await User.create({ email, name, password: hashed, role: role as 'parent' | 'trainer', isVerified: true });
    }
    await OtpCode.deleteMany({ email });
    await recordConsent(req, { userId: user._id, type: 'account' });

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
    const email = normEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

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
    const email = normEmail(req.body?.email);
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ message: 'Некорректный email' });
      return;
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      // Не раскрываем, существует ли аккаунт
      res.json({ message: 'Если аккаунт существует, код отправлен на почту' });
      return;
    }

    const code = await issueOtp(email, 'reset');
    await deliverOtp(email, code, 'Reset');

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
    const email = normEmail(req.body?.email);
    const code = str(req.body?.code);
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!email || !code || !newPassword) {
      res.status(400).json({ message: 'Все поля обязательны' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      res.status(400).json({ message: `Пароль должен содержать минимум ${MIN_PASSWORD} символов` });
      return;
    }

    const result = await checkOtp(email, code, 'reset');
    if ('error' in result) {
      res.status(400).json({ message: result.error });
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
    const name = str(req.body?.name);
    const photo = typeof req.body?.photo === 'string' ? req.body.photo : undefined;
    if (!name || name.length < 2) {
      res.status(400).json({ message: 'Имя слишком короткое' });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { name, photo },
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
    // Родитель удаляет аккаунт — удаляются и все данные его детей (включая медицинские документы)
    if (req.user?.role === 'parent') {
      const children = await Child.find({ parentId: req.user.id }).select('_id');
      for (const c of children) await purgeChildData(c._id);
    }
    await User.findByIdAndDelete(req.user?.id);
    await cancelEnrollmentForDeletedUser(req.user?.id, req.user?.role);
    res.json({ message: 'Аккаунт удалён' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
