import { Schema, model } from 'mongoose';
import { IEmotion } from '../types';

const emotionSchema = new Schema<IEmotion>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mood: {
      type: String,
      enum: ['calm', 'happy', 'anxious', 'overwhelmed', 'sad', 'angry', 'excited'],
      required: true,
    },
    intensity: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
  },
  { timestamps: true }
);

export default model<IEmotion>('Emotion', emotionSchema);
