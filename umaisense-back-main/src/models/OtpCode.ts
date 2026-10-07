import { Schema, model, Document } from 'mongoose';

interface IOtpCode extends Document {
  email: string;
  code: string;
  purpose: 'register' | 'reset';
  attempts: number;
  verified: boolean;
  registrationTokenHash?: string;
  expiresAt: Date;
}

const otpSchema = new Schema<IOtpCode>({
  email: { type: String, required: true, lowercase: true, trim: true },
  code: { type: String, required: true },
  // Код регистрации нельзя использовать для сброса пароля и наоборот
  purpose: { type: String, enum: ['register', 'reset'], default: 'register' },
  // Число неверных попыток: после MAX_OTP_ATTEMPTS код сгорает (защита от перебора)
  attempts: { type: Number, default: 0 },
  // true — email подтверждён кодом, можно завершать регистрацию
  verified: { type: Boolean, default: false },
  // Хеш одноразового токена, выданного после ввода кода. Завершить регистрацию может только
  // тот, кто ввёл код (иначе знающий email мог бы перехватить регистрацию в эти 15 минут).
  registrationTokenHash: { type: String },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export default model<IOtpCode>('OtpCode', otpSchema);
