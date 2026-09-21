import { Schema, model } from 'mongoose';
import { IDocument } from '../types';

const documentSchema = new Schema<IDocument>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    aiStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
    aiExplanation: { type: String },
  },
  { timestamps: true }
);

export default model<IDocument>('Document', documentSchema);
