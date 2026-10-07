import { Schema, model } from 'mongoose';
import { IAssignment } from '../types';

/**
 * Закрепление ребёнка за тренером, созданное администратором по заявке.
 * Тренер получает доступ к ребёнку только после ввода accessCode.
 */
const assignmentSchema = new Schema<IAssignment>(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'EnrollmentRequest', required: true },
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    slots: [
      {
        _id: false,
        weekday: { type: Number, min: 1, max: 7, required: true },
        startTime: { type: String, required: true },
      },
    ],
    durationMin: { type: Number, default: 45, min: 15, max: 240 },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    accessCode: { type: String, required: true, unique: true },
    codeUsed: { type: Boolean, default: false },
    activatedAt: { type: Date },
    // true — у тренера был доступ к ребёнку до этой записи (по старому коду от родителя)
    hadAccessBefore: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    cancelReason: { type: String, trim: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

export default model<IAssignment>('Assignment', assignmentSchema);
