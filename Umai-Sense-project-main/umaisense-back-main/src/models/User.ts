import { Schema, model } from 'mongoose';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    photo: { type: String },
    role: { type: String, enum: ['parent', 'trainer', 'admin'], required: true },
    password: { type: String, select: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<IUser>('User', userSchema);
