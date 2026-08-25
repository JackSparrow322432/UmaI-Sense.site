import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name: string;
  photo?: string;
  role: 'parent' | 'trainer' | 'admin';
  password?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChild extends Document {
  _id: Types.ObjectId;
  parentId: Types.ObjectId;
  name: string;
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

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: 'diary_entry' | 'invite_accepted' | 'ai_recommendation' | 'emotion_reminder' | 'new_article';
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
