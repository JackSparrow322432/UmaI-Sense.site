import { Schema, model } from 'mongoose';
import { IRecommendation } from '../types';

const recommendationSchema = new Schema<IRecommendation>({
  childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
  content: {
    calmingTechniques: [String],
    activitiesForToday: [String],
    communicationTips: [String],
    attentionPoints: [String],
  },
  generatedAt: { type: Date, default: Date.now },
});

export default model<IRecommendation>('Recommendation', recommendationSchema);
