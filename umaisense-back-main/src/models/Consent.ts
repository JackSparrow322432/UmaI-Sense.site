import { Schema, model, Types, Document } from 'mongoose';

/**
 * account              — обработка ПД родителя/тренера (обязательно)
 * child_data           — обработка ПД ребёнка законным представителем (обязательно)
 * third_party_transfer — передача третьим лицам из перечня в Политике (обязательно)
 * cross_border         — трансграничная передача ОБЕЗЛИЧЕННЫХ данных внешнему ИИ (необязательно)
 * ai_screening         — ИИ-скрининг профиля ребёнка (необязательно, запрашивается при первом запуске)
 */
export const CONSENT_TYPES = ['account', 'child_data', 'third_party_transfer', 'cross_border', 'ai_screening'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
/** Необязательные согласия — их можно отозвать без удаления аккаунта */
export const OPTIONAL_CONSENTS: ConsentType[] = ['cross_border', 'ai_screening'];

/**
 * Согласие на сбор и обработку персональных данных (Закон РК № 94-V).
 * Хранится отдельной записью с версией текста, временем и IP — это доказательство
 * того, что согласие было дано, и на какой редакции политики.
 */
export interface IConsent extends Document {
  userId: Types.ObjectId;
  childId?: Types.ObjectId;
  type: ConsentType;
  version: string;
  ip?: string;
  userAgent?: string;
  withdrawnAt?: Date;
  createdAt: Date;
}

const consentSchema = new Schema<IConsent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    childId: { type: Schema.Types.ObjectId, ref: 'Child' },
    type: { type: String, enum: CONSENT_TYPES, required: true },
    version: { type: String, required: true },
    ip: { type: String },
    userAgent: { type: String },
    withdrawnAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

consentSchema.index({ userId: 1, type: 1, withdrawnAt: 1 });

export default model<IConsent>('Consent', consentSchema);
