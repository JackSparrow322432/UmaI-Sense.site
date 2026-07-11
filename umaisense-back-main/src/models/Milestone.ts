import { Schema, model } from 'mongoose';
import { IMilestone, IChildMilestone } from '../types';

const milestoneSchema = new Schema<IMilestone>({
  ageGroup: { type: String, required: true },
  direction: {
    type: String,
    enum: ['cognitive', 'motor', 'social', 'speech', 'selfcare'],
    required: true,
  },
  skill: { type: String, required: true },
  description: { type: String },
});

const childMilestoneSchema = new Schema<IChildMilestone>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', required: true },
    status: { type: String, enum: ['achieved', 'in_progress', 'not_yet'], default: 'not_yet' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Milestone = model<IMilestone>('Milestone', milestoneSchema);
export const ChildMilestone = model<IChildMilestone>('ChildMilestone', childMilestoneSchema);
