import { Schema, model } from 'mongoose';
import { IInviteCode } from '../types';

const inviteCodeSchema = new Schema<IInviteCode>({
  code: { type: String, required: true, unique: true },
  childId: { type: Schema.Types.ObjectId, ref: 'Child', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

export default model<IInviteCode>('InviteCode', inviteCodeSchema);
