export type UserRole = 'parent' | 'trainer' | 'admin';

export interface User {
  _id: string;
  email: string;
  name: string;
  photo?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Child {
  _id: string;
  parentId: string;
  name: string;
  dateOfBirth: string;
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
  trainers: User[];
  createdAt: string;
  updatedAt: string;
}

export type MoodType = 'calm' | 'happy' | 'anxious' | 'overwhelmed' | 'sad' | 'angry' | 'excited';

export interface Emotion {
  _id: string;
  childId: string;
  recordedBy: Pick<User, '_id' | 'name' | 'role'>;
  mood: MoodType;
  intensity: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

export type ActivityCategory = 'hobby' | 'therapy' | 'study' | 'walk' | 'social' | 'other';

export interface Activity {
  _id: string;
  childId: string;
  recordedBy: Pick<User, '_id' | 'name' | 'role'>;
  name: string;
  category: ActivityCategory;
  date: string;
  duration?: number;
  notes?: string;
  createdAt: string;
}

export type DiaryTag = 'trigger' | 'mood' | 'info' | 'progress';

export interface DiaryEntry {
  _id: string;
  childId: string;
  author: Pick<User, '_id' | 'name' | 'role'>;
  text: string;
  tag: DiaryTag;
  media?: string[];
  linkedMilestone?: string;
  createdAt: string;
}

export type MilestoneDirection = 'cognitive' | 'motor' | 'social' | 'speech' | 'selfcare';
export type MilestoneStatus = 'achieved' | 'in_progress' | 'not_yet';

export interface Milestone {
  _id: string;
  ageGroup: string;
  direction: MilestoneDirection;
  skill: string;
  description?: string;
}

export interface ChildMilestone {
  _id: string;
  childId: string;
  milestoneId: Milestone;
  status: MilestoneStatus;
  updatedBy: string;
  updatedAt: string;
}

export interface Recommendation {
  _id: string;
  childId: string;
  content: {
    calmingTechniques?: string[];
    activitiesForToday?: string[];
    communicationTips?: string[];
    attentionPoints?: string[];
  };
  generatedAt: string;
}

export type NotificationType = 'diary_entry' | 'invite_accepted' | 'ai_recommendation' | 'emotion_reminder' | 'new_article';

export interface Article {
  _id: string;
  title: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  published: boolean;
  publishedAt?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  relatedId?: string;
  createdAt: string;
}

export interface InviteCode {
  _id: string;
  code: string;
  childId: string;
  parentId: string;
  expiresAt: string;
  used: boolean;
}
