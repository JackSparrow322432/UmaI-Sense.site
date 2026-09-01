import api from './axios';
import type {
  User, Child, Emotion, Activity, DiaryEntry,
  Milestone, ChildMilestone, Recommendation,
  Notification, InviteCode, MoodType,
  ActivityCategory, DiaryTag, MilestoneStatus, Article,
} from '../types';

// Auth
export const authApi = {
  sendOtp: (email: string, role: string) => api.post('/auth/send-otp', { email, role }),
  resendOtp: (email: string) => api.post('/auth/resend-otp', { email }),
  verifyOtp: (email: string, code: string) =>
    api.post<{ verified: boolean; email: string }>('/auth/verify-otp', { email, code }),
  completeRegistration: (data: { email: string; name: string; password: string; role: string }) =>
    api.post<{ token: string; user: User }>('/auth/complete-registration', data),
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    api.post('/auth/reset-password', { email, code, newPassword }),
  getMe: () => api.get<User>('/auth/me'),
  updateProfile: (data: Partial<Pick<User, 'name' | 'photo'>>) => api.put<User>('/auth/profile', data),
  deleteAccount: () => api.delete('/auth/account'),
};

// Upload
export const uploadApi = {
  image: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post<{ url: string }>('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Children
export const childrenApi = {
  getAll: () => api.get<Child[]>('/children'),
  getOne: (id: string) => api.get<Child>(`/children/${id}`),
  create: (data: Partial<Child>) => api.post<Child>('/children', data),
  update: (id: string, data: Partial<Child>) => api.put<Child>(`/children/${id}`, data),
  delete: (id: string) => api.delete(`/children/${id}`),
  removeTrainer: (childId: string, trainerId: string) =>
    api.delete(`/children/${childId}/trainers/${trainerId}`),
};

// Invites
export const invitesApi = {
  create: (childId: string) => api.post<InviteCode>('/invites/create', { childId }),
  use: (code: string) => api.post<{ message: string; child: Child }>('/invites/use', { code }),
};

// Emotions
export const emotionsApi = {
  getAll: (childId: string) => api.get<Emotion[]>(`/emotions/${childId}`),
  add: (childId: string, data: { mood: MoodType; intensity: number; comment?: string }) =>
    api.post<Emotion>(`/emotions/${childId}`, data),
  delete: (childId: string, emotionId: string) => api.delete(`/emotions/${childId}/${emotionId}`),
};

// Activities
export const activitiesApi = {
  getAll: (childId: string, category?: ActivityCategory) =>
    api.get<Activity[]>(`/activities/${childId}`, { params: category ? { category } : {} }),
  add: (childId: string, data: Omit<Activity, '_id' | 'childId' | 'recordedBy' | 'createdAt'>) =>
    api.post<Activity>(`/activities/${childId}`, data),
  delete: (childId: string, activityId: string) =>
    api.delete(`/activities/${childId}/${activityId}`),
};

// Diary
export const diaryApi = {
  getAll: (childId: string, filters?: { tag?: DiaryTag; author?: string }) =>
    api.get<DiaryEntry[]>(`/diary/${childId}`, { params: filters }),
  add: (childId: string, data: { text: string; tag: DiaryTag; media?: string[] }) =>
    api.post<DiaryEntry>(`/diary/${childId}`, data),
  delete: (childId: string, entryId: string) => api.delete(`/diary/${childId}/${entryId}`),
};

// Milestones
export const milestonesApi = {
  getAll: () => api.get<Milestone[]>('/milestones'),
  getForChild: (childId: string) => api.get<ChildMilestone[]>(`/milestones/${childId}`),
  update: (childId: string, milestoneId: string, status: MilestoneStatus) =>
    api.put<ChildMilestone>(`/milestones/${childId}/${milestoneId}`, { status }),
};

// Recommendations
export const recommendationsApi = {
  getAll: (childId: string) => api.get<Recommendation[]>(`/recommendations/${childId}`),
  generate: (childId: string) => api.post<Recommendation>(`/recommendations/${childId}/generate`),
};

// Notifications
export const notificationsApi = {
  getAll: () => api.get<Notification[]>('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Articles
export const articlesApi = {
  getAll: () => api.get<Article[]>('/articles'),
  getOne: (id: string) => api.get<Article>(`/articles/${id}`),
  create: (data: Partial<Article>) => api.post<Article>('/articles', data),
  update: (id: string, data: Partial<Article>) => api.put<Article>(`/articles/${id}`, data),
  delete: (id: string) => api.delete(`/articles/${id}`),
};

// Admin
export const adminApi = {
  getUsers: () => api.get<User[]>('/admin/users'),
  getUserDetail: (id: string) => api.get<{ user: User; children: Child[] }>(`/admin/users/${id}`),
  getChildDetail: (childId: string) => api.get<{
    child: Child & { parentId: Pick<User,'_id'|'name'|'email'>; trainers: Pick<User,'_id'|'name'|'email'>[] };
    emotions: Emotion[];
    activities: Activity[];
    diary: DiaryEntry[];
    stats: { totalEmotions: number; totalActivities: number; totalDiary: number };
  }>(`/admin/children/${childId}`),
};
