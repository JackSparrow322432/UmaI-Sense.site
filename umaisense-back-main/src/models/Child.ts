import { Schema, model } from 'mongoose';
import { IChild } from '../types';

const childSchema = new Schema<IChild>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    lastName: { type: String, trim: true },
    iin: { type: String, trim: true },
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
    // Катался ли ребёнок когда-либо на лыжах или обучался, и когда (обязательно для записи)
    skiExperience: {
      hasExperience: { type: Boolean },
      when: { type: String, trim: true },
    },
    // Проходил ли адаптивное катание: when — даты занятий, details — подробности (необязательно)
    adaptiveSkating: {
      hasExperience: { type: Boolean },
      when: { type: String, trim: true },
      details: { type: String, trim: true },
    },
    trainers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default model<IChild>('Child', childSchema);
