import { Schema, model, Types } from 'mongoose';
import { IChild } from '../types';

const childSchema = new Schema<IChild>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    photo: { type: String },
    diagnosis: { type: String },
    communicationMethod: { type: String },
    fears: [{ type: String }],
    triggers: [{ type: String }],
    interests: [{ type: String }],
    calmingActivities: [{ type: String }],
    sensoryProfile: {
      sound: String,
      light: String,
      touch: String,
      smell: String,
      taste: String,
    },
    behavioralNotes: { type: String },
    goals: [
      {
        title: { type: String, required: true },
        description: { type: String },
      },
    ],
    trainers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default model<IChild>('Child', childSchema);
