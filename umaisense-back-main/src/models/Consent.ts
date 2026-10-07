import { Schema, model, Types, Document } from 'mongoose';

/**
 * Согласие на сбор и обработку персональных данных (Закон РК № 94-V).
 * Хранится отдельной записью с версией текста, временем и IP — это доказательство
 * того, что согласие было дано, и на какой редакции политики.
 */
export interface IConsent extends Document {
  userId: Types.ObjectId;
  childId?: Types.ObjectId;
  type: 'account' | 'child_data';
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
    type: { type: String, enum: ['account', 'child_data'], required: true },
    version: { type: String, required: true },
    ip: { type: String },
    userAgent: { type: String },
    withdrawnAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default model<IConsent>('Consent', consentSchema);
