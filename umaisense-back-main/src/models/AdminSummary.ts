import { Schema, model, Types, Document } from 'mongoose';

/**
 * ИИ-сводка по ребёнку для администратора: профиль + документы + наблюдения → краткая справка.
 * inputSummary — какие разделы и документы учтены (без самих данных).
 * Ссылки на документы в result.medical[].source — метки «Д1», «Д2»… из inputSummary.documents.
 */
export interface IAdminSummaryResult {
  overview: string;
  medical: { text: string; source?: string }[];
  restrictions: string[];
  safety: string[];
  strengths: string[];
  dynamics: string;
  adminRecommendations: string[];
  gaps: string[];
  contradictions: string[];
}

export interface IAdminSummaryDoc {
  ref: string;          // «Д1»
  fileName: string;
  kind: string;         // тип документа (по расшифровке) или формат файла
  uploadedAt: Date;
  used: boolean;
  reason?: string;      // почему не учтён
}

export interface IAdminSummary extends Document {
  childId: Types.ObjectId;
  createdBy: Types.ObjectId;
  provider: 'openai' | 'yandex' | 'local';
  aiModel: string;
  status: 'pending' | 'done' | 'failed';
  inputSummary: {
    sections: string[];
    periodDays: number;
    documents: IAdminSummaryDoc[];
    documentsTotal: number;
    documentsUsed: number;
    notes: string[];    // что не учтено и почему (согласия, лимиты)
  };
  result?: IAdminSummaryResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSummarySchema = new Schema<IAdminSummary>(
  {
    childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['openai', 'yandex', 'local'], required: true },
    aiModel: { type: String, required: true },
    status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
    inputSummary: { type: Schema.Types.Mixed, required: true },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  { timestamps: true }
);

adminSummarySchema.index({ childId: 1, createdAt: -1 });

export default model<IAdminSummary>('AdminSummary', adminSummarySchema);
