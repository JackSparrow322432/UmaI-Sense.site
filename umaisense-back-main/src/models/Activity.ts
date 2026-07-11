import { Schema, model } from 'mongoose';
import { IActivity } from '../types';

const activitySchema = new Schema<IActivity>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['hobby', 'therapy', 'study', 'walk', 'social', 'other'],
      required: true,
    },
    date: { type: Date, required: true },
    duration: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

export default model<IActivity>('Activity', activitySchema);
