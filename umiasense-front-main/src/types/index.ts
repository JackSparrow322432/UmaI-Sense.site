// ФАЙЛ: umiasense-front-main/src/types/index.ts
// ПОЛНАЯ ЗАМЕНА ФАЙЛА

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

/** Проходил ли адаптивное катание: when — даты, details — подробности (необязательно) */
export interface AdaptiveSkating {
  hasExperience: boolean;
  when?: string;
  details?: string;
}

/** Катался ли когда-либо на лыжах или обучался, и когда именно */
export interface SkiExperience {
  hasExperience: boolean;
  when?: string;
}

export interface Child {
  _id: string;
  parentId: string;
  name: string;
  lastName?: string;
  iin?: string;
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
  adaptiveSkating?: AdaptiveSkating;
  skiExperience?: SkiExperience;
  trainers: User[];
  /** Тренеры, записанные администратором (только в GET /children/:id) — родитель не может их откреплять */
  managedTrainerIds?: string[];
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

export type NotificationType =
  | 'diary_entry' | 'invite_accepted' | 'ai_recommendation' | 'emotion_reminder' | 'new_article' | 'new_task'
  | 'enrollment_update' | 'trainer_assigned' | 'session_cancelled';

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

export interface Task {
  _id: string;
  title: string;
  description?: string;
  content?: string;
  coverImage?: string;
  published: boolean;
  publishedAt?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRating {
  _id: string;
  taskId: string;
  childId: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  ratedBy?: string;
  submissionUrl?: string;
  submissionFileName?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Ответ /tasks/:id/submissions (только для админа) — та же запись,
// но childId уже развёрнут в объект ребёнка (и его родителя) для отображения.
export interface TaskSubmissionAdmin {
  _id: string;
  taskId: string;
  childId: {
    _id: string;
    name: string;
    photo?: string;
    parentId?: { _id: string; name: string };
  };
  rating?: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  ratedBy?: string;
  submissionUrl?: string;
  submissionFileName?: string;
  submittedAt?: string;
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

export interface DocumentItem {
  _id: string;
  childId: string;
  uploadedBy: Pick<User, '_id' | 'name' | 'role'> | string;
  fileUrl?: string;   // только у старых документов до переезда
  fileName: string;
  mimeType: string;
  size?: number;
  status?: 'uploading' | 'ready';
  aiStatus: 'pending' | 'done' | 'failed' | 'disabled';
  aiExplanation?: string;
  aiResult?: DocumentAiResult;
  aiAt?: string;
  aiError?: string;
  createdAt: string;
  updatedAt: string;
}

/** ИИ-расшифровка медицинского документа */
export interface DocumentAiResult {
  docType: string;
  summary: string;
  keyFindings: string[];
  terms: { term: string; meaning: string }[];
  recommendations: string[];
  questionsForDoctor: string[];
  forTrainer: string[];
}

export interface DocumentAiStatus {
  enabled: boolean;
  images: boolean;
  reason?: string;
  provider: 'openai' | 'local' | 'off';
  missingConsents: ConsentType[];
}

// ─── Запись на занятия ───────────────────────────────────────────────────────

/** 1 = Пн … 7 = Вс */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ScheduleSlot { weekday: Weekday; startTime: string }

type ChildBrief = Pick<Child, '_id' | 'name' | 'lastName' | 'photo' | 'dateOfBirth'> &
  Partial<Pick<Child, 'iin' | 'diagnosis' | 'communicationMethod' | 'adaptiveSkating' | 'skiExperience'>>;
type UserBrief = Pick<User, '_id' | 'name'> & Partial<Pick<User, 'email' | 'photo'>>;

export interface Assignment {
  _id: string;
  requestId: string;
  childId: string | ChildBrief;
  parentId: string | UserBrief;
  trainerId: string | UserBrief;
  slots: ScheduleSlot[];
  durationMin: number;
  startDate: string;
  endDate: string;
  accessCode?: string;   // виден только администратору
  codeUsed: boolean;
  activatedAt?: string;
  status: 'active' | 'cancelled';
  cancelReason?: string;
  contactPhone?: string; // в карточке тренера после ввода кода
  createdAt: string;
}

export type RequestStatus = 'pending' | 'approved' | 'cancelled';

export interface EnrollmentRequest {
  _id: string;
  parentId: string | UserBrief;
  childId: ChildBrief;
  preferredDays: Weekday[];
  preferredTimeFrom?: string;
  preferredTimeTo?: string;
  contactPhone: string;
  comment?: string;
  status: RequestStatus;
  cancelledBy?: 'parent' | 'admin';
  adminComment?: string;
  assignments: Assignment[];
  createdAt: string;
}

export interface Session {
  _id: string;
  assignmentId: string;
  childId: Pick<Child, '_id' | 'name' | 'lastName' | 'photo'>;
  trainerId: UserBrief;
  parentId: UserBrief;
  date: string;      // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  endTime: string;
  status: 'scheduled' | 'cancelled';
  cancelReason?: string;
}

export interface AccessLogEntry {
  _id: string;
  action: 'document.upload' | 'document.view' | 'document.delete' | 'child.view' | 'child.access_granted' | 'screening.run' | 'screening.view' | 'report.download' | 'document.ai_explain';
  userId?: Pick<User, '_id' | 'name' | 'role'> | null;
  role?: UserRole;
  createdAt: string;
}

// ─── Согласия на обработку персональных данных ──────────────────────────────

export type ConsentType = 'account' | 'child_data' | 'third_party_transfer' | 'cross_border' | 'ai_screening' | 'documents_ai';

export interface ConsentRecord {
  _id: string;
  type: ConsentType;
  version: string;
  childId?: { _id: string; name: string; lastName?: string } | null;
  createdAt: string;
  withdrawnAt?: string;
}

export interface ConsentStatus {
  currentVersion: string;
  missingRequired: ConsentType[];
  active: { cross_border: boolean; ai_screening: boolean; documents_ai: boolean };
  consents: ConsentRecord[];
}

// ─── ИИ-скрининг ─────────────────────────────────────────────────────────────

export type ScreeningSection =
  | 'basic' | 'sensory' | 'fears' | 'interests' | 'goals' | 'behavioral'
  | 'skating' | 'documents' | 'observations' | 'milestones';

export interface ScreeningResult {
  summary: string;
  strengths: string[];
  attentionAreas: { area: string; observation: string; level: 'low' | 'medium' | 'high' }[];
  risks: string[];
  recommendationsParent: string[];
  recommendationsTrainer: string[];
  specialists: { specialist: string; reason: string }[];
  missingData: { section: ScreeningSection; why: string }[];
}

export interface Screening {
  _id: string;
  childId: string;
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
  result?: ScreeningResult;
  error?: string;
  createdAt: string;
}

export interface ScreeningStatus {
  provider: 'openai' | 'local' | 'off';
  enabled: boolean;
  documentsMode: 'none' | 'types_only' | 'text';
  missingConsents: ConsentType[];
  dailyLimit: number;
}
