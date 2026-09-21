export interface IDocument extends Document {
  _id: Types.ObjectId;
  childId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  aiStatus: 'pending' | 'done' | 'failed';
  aiExplanation?: string;
  createdAt: Date;
  updatedAt: Date;
}
