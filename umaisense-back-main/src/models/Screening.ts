import { Schema, model, Types, Document } from 'mongoose';

/**
 * Отчёт ИИ-скрининга ребёнка.
 * inputSummary — КАКИЕ разделы данных использованы (без самих данных): это ответ на вопрос
 * родителя «что ушло в ИИ» и подтверждение, что документы не уходили во внешний сервис.
 */
export interface IScreeningResult {
  summary: string;
  strengths: string[];
  attentionAreas: { area: string; observation: string; level: 'low' | 'medium' | 'high' }[];
  risks: string[];
  recommendationsParent: string[];
  recommendationsTrainer: string[];
  specialists: { specialist: string; reason: string }[];
  missingData: { section: string; why: string }[];
}

export interface IScreening extends Document {
  childId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  provider: 'openai' | 'local';
  aiModel: string;
  status: 'pending' | 'done' | 'failed';
  inputSummary: {
    sections: string[];
    periodDays: number;
    counts: { emotions: number; activities: number; diary: number; milestones: number; documents: number };
    documentsMode: 'none' | 'types_only' | 'text';
    documentsSkipped?: number;
  };
  result?: IScreeningResult;
  consentVersion: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const screeningSchema = new Schema<IScreening>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['openai', 'local'], required: true },
    aiModel: { type: String, required: true },
    status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
    inputSummary: { type: Schema.Types.Mixed, required: true },
    result: { type: Schema.Types.Mixed },
    consentVersion: { type: String, required: true },
    error: { type: String },
  },
  { timestamps: true }
);

screeningSchema.index({ childId: 1, createdAt: -1 });

export default model<IScreening>('Screening', screeningSchema);
