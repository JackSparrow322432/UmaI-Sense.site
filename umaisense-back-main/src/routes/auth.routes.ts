import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  sendOtp,
  resendOtp,
  verifyOtp,
  completeRegistration,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  deleteAccount,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Слишком много запросов. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Перебор 6-значного кода: дополнительно к 5 попыткам на сам код.
// Отдельный счётчик на каждый шаг — чтобы семья/школа за одним IP не блокировала друг друга.
const codeCheckLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Слишком много попыток. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration
router.post('/send-otp', otpLimiter, sendOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/verify-otp', codeCheckLimiter(), verifyOtp);
router.post('/complete-registration', codeCheckLimiter(), completeRegistration);

// Login
router.post('/login', loginLimiter, login);

// Password reset
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', codeCheckLimiter(), resetPassword);

// Authenticated
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.delete('/account', protect, deleteAccount);

export default router;
