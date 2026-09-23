import { Schema, model, Document, Types } from 'mongoose';

export interface ITaskRating extends Document {
  taskId: Types.ObjectId;
  childId: Types.ObjectId;
  rating?: number; // 1–5
  comment?: string;
  ratedBy?: Types.ObjectId;
  submissionUrl?: string;
  submissionFileName?: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskRatingSchema = new Schema<ITaskRating>(
  {
    taskId:  { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    rating:  { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true },
    ratedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submissionUrl:      { type: String },
    submissionFileName: { type: String },
    submittedAt:         { type: Date },
  },
  { timestamps: true }
);

taskRatingSchema.index({ taskId: 1, childId: 1 }, { unique: true });

export default model<ITaskRating>('TaskRating', taskRatingSchema);
