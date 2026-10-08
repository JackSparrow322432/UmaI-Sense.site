import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name: string;
  photo?: string;
  role: 'parent' | 'trainer' | 'admin';
  formerRole?: 'parent' | 'trainer';
  password?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChild extends Document {
  _id: Types.ObjectId;
  parentId: Types.ObjectId;
  name: string;
  lastName?: string;
  iin?: string;
  dateOfBirth: Date;
  photo?: string;
  diagnosis?: string;
  communicationMethod?: string;
  fears?: string[];
  triggers?: string[];
  interests?: string[];
  calmingActivities?: string[];
  sensoryProfile?: {
    sound?: string;
    light?: string;
    touch?: string;
    smell?: string;
    taste?: string;
  };
  behavioralNotes?: string;
  goals?: Array<{ title: string; description?: string }>;
  adaptiveSkating?: {
    hasExperience: boolean;
    when?: string;
    details?: string;
  };
  skiExperience?: {
    hasExperience: boolean;
    when?: string;
  };
  trainers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IInviteCode extends Document {
  code: string;
  childId: Types.ObjectId;
  parentId: Types.ObjectId;
  expiresAt: Date;
  used: boolean;
  usedBy?: Types.ObjectId;
}

export interface IEmotion extends Document {
  childId: Types.ObjectId;
  recordedBy: Types.ObjectId;
  mood: 'calm' | 'happy' | 'anxious' | 'overwhelmed' | 'sad' | 'angry' | 'excited';
  intensity: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: Date;
}

export interface IActivity extends Document {
  childId: Types.ObjectId;
  recordedBy: Types.ObjectId;
  name: string;
  category: 'hobby' | 'therapy' | 'study' | 'walk' | 'social' | 'other';
  date: Date;
  duration?: number;
  notes?: string;
  createdAt: Date;
}

export interface IDiaryEntry extends Document {
  childId: Types.ObjectId;
  author: Types.ObjectId;
  text: string;
  tag: 'trigger' | 'mood' | 'info' | 'progress';
  media?: string[];
  linkedMilestone?: Types.ObjectId;
  createdAt: Date;
}

export interface IMilestone extends Document {
  ageGroup: string;
  direction: 'cognitive' | 'motor' | 'social' | 'speech' | 'selfcare';
  skill: string;
  description?: string;
}

export interface IChildMilestone extends Document {
  childId: Types.ObjectId;
  milestoneId: Types.ObjectId;
  status: 'achieved' | 'in_progress' | 'not_yet';
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

export interface IRecommendation extends Document {
  childId: Types.ObjectId;
  content: {
    calmingTechniques?: string[];
    activitiesForToday?: string[];
    communicationTips?: string[];
    attentionPoints?: string[];
  };
  generatedAt: Date;
}

export type NotificationType =
  | 'diary_entry' | 'invite_accepted' | 'ai_recommendation' | 'emotion_reminder'
  | 'new_article' | 'new_task'
  | 'enrollment_update' | 'trainer_assigned' | 'session_cancelled';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  message: string;
  read: boolean;
  relatedId?: Types.ObjectId;
  createdAt: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'parent' | 'trainer' | 'admin';
  };
}

export interface IDocument extends Document {
  _id: Types.ObjectId;
  childId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  storageKey?: string;
  storageProvider?: 's3' | 'cloudinary';
  fileUrl?: string;
  fileName: string;
  mimeType: string;
  size?: number;
  status: 'uploading' | 'ready';
  uploadExpiresAt?: Date;
  aiStatus: 'pending' | 'done' | 'failed' | 'disabled';
  aiExplanation?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Запись на занятия ───────────────────────────────────────────────────────

/** День недели: 1 = понедельник … 7 = воскресенье */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface IEnrollmentRequest extends Document {
  _id: Types.ObjectId;
  parentId: Types.ObjectId;
  childId: Types.ObjectId;
  preferredDays: Weekday[];
  preferredTimeFrom?: string; // 'HH:mm'
  preferredTimeTo?: string;   // 'HH:mm'
  contactPhone: string;
  comment?: string;
  status: 'pending' | 'approved' | 'cancelled';
  cancelledBy?: 'parent' | 'admin';
  adminComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssignment extends Document {
  _id: Types.ObjectId;
  requestId: Types.ObjectId;
  childId: Types.ObjectId;
  parentId: Types.ObjectId;
  trainerId: Types.ObjectId;
  slots: Array<{ weekday: Weekday; startTime: string }>;
  durationMin: number;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  accessCode: string;
  codeUsed: boolean;
  activatedAt?: Date;
  hadAccessBefore?: boolean;
  status: 'active' | 'cancelled';
  cancelReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISession extends Document {
  _id: Types.ObjectId;
  assignmentId: Types.ObjectId;
  requestId: Types.ObjectId;
  childId: Types.ObjectId;
  parentId: Types.ObjectId;
  trainerId: Types.ObjectId;
  date: string;      // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  endTime: string;   // 'HH:mm'
  status: 'scheduled' | 'cancelled';
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
