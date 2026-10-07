import { Schema, model } from 'mongoose';
import { IEnrollmentRequest } from '../types';

/** Заявка родителя на запись ребёнка к тренеру. Обрабатывается администратором. */
const enrollmentRequestSchema = new Schema<IEnrollmentRequest>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    preferredDays: [{ type: Number, min: 1, max: 7 }],
    preferredTimeFrom: { type: String },
    preferredTimeTo: { type: String },
    contactPhone: { type: String, required: true, trim: true },
    comment: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'cancelled'], default: 'pending' },
    cancelledBy: { type: String, enum: ['parent', 'admin'] },
    adminComment: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model<IEnrollmentRequest>('EnrollmentRequest', enrollmentRequestSchema);
