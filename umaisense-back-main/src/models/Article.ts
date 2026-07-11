import { Schema, model, Document, Types } from 'mongoose';

export interface IArticle extends Document {
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  published: boolean;
  publishedAt?: Date;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<IArticle>(
  {
    title:       { type: String, required: true, trim: true },
    excerpt:     { type: String, trim: true },
    content:     { type: String, required: true },
    coverImage:  { type: String },
    published:   { type: Boolean, default: false },
    publishedAt: { type: Date },
    author:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default model<IArticle>('Article', articleSchema);
