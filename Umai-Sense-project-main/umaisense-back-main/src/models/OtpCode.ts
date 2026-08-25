import { Schema, model, Document } from 'mongoose';

interface IOtpCode extends Document {
  email: string;
  code: string;
  expiresAt: Date;
}

const otpSchema = new Schema<IOtpCode>({
  email: { type: String, required: true, lowercase: true, trim: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export default model<IOtpCode>('OtpCode', otpSchema);
