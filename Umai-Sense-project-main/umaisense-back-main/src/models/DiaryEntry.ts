import { Schema, model } from 'mongoose';
import { IDiaryEntry } from '../types';

const diaryEntrySchema = new Schema<IDiaryEntry>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    tag: { type: String, enum: ['trigger', 'mood', 'info', 'progress'], required: true },
    media: [{ type: String }],
    linkedMilestone: { type: Schema.Types.ObjectId, ref: 'Milestone' },
  },
  { timestamps: true }
);

export default model<IDiaryEntry>('DiaryEntry', diaryEntrySchema);
