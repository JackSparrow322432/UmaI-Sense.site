import { Schema, model } from 'mongoose';
import { ISession } from '../types';

/**
 * Конкретное занятие в календаре.
 * Дата и время хранятся строками ('YYYY-MM-DD', 'HH:mm') в местном времени катка,
 * чтобы расписание не «съезжало» из-за часовых поясов сервера/браузера.
 */
const sessionSchema = new Schema<ISession>(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    requestId: { type: Schema.Types.ObjectId, ref: 'EnrollmentRequest', required: true },
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model<ISession>('Session', sessionSchema);
