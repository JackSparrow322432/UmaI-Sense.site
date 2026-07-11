import { Schema, model } from 'mongoose';
import { INotification } from '../types';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['diary_entry', 'invite_accepted', 'ai_recommendation', 'emotion_reminder', 'new_article'],
      required: true,
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    relatedId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

export default model<INotification>('Notification', notificationSchema);
