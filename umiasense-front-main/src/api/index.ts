
import api from './axios';
import type { UploadTarget } from '../utils/directUpload';
import type {
  User, Child, Emotion, Activity, DiaryEntry,
  Milestone, ChildMilestone, Recommendation,
  Notification, InviteCode, MoodType,
  ActivityCategory, DiaryTag, MilestoneStatus, Article, DocumentItem,
  Task, TaskRating, TaskSubmissionAdmin, AccessLogEntry,
  EnrollmentRequest, Assignment, Session, ScheduleSlot, Weekday, RequestStatus,
} from '../types';

export const authApi = {
  sendOtp: (email: string, role: string) => api.post('/auth/send-otp', { email, role }),
  resendOtp: (email: string) => api.post('/auth/resend-otp', { email }),
  verifyOtp: (email: string, code: string) =>
    api.post<{ verified: boolean; email: string; registrationToken: string }>('/auth/verify-otp', { email, code }),
  completeRegistration: (data: { email: string; name: string; password: string; role: string; consent: boolean; registrationToken: string }) =>
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

export const uploadApi = {
  image: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post<{ url: string }>('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const childrenApi = {
  getAll: () => api.get<Child[]>('/children'),
  getOne: (id: string) => api.get<Child>(`/children/${id}`),
  create: (data: Partial<Child> & { consent: boolean }) => api.post<Child>('/children', data),
  update: (id: string, data: Partial<Child>) => api.put<Child>(`/children/${id}`, data),
  delete: (id: string) => api.delete(`/children/${id}`),
  removeTrainer: (childId: string, trainerId: string) =>
    api.delete(`/children/${childId}/trainers/${trainerId}`),
  getAccessLog: (childId: string) => api.get<AccessLogEntry[]>(`/children/${childId}/access-log`),
};

export const invitesApi = {
  create: (childId: string) => api.post<InviteCode>('/invites/create', { childId }),
  use: (code: string) => api.post<{ message: string; child: Child }>('/invites/use', { code }),
};

export const emotionsApi = {
  getAll: (childId: string) => api.get<Emotion[]>(`/emotions/${childId}`),
  add: (childId: string, data: { mood: MoodType; intensity: number; comment?: string }) =>
    api.post<Emotion>(`/emotions/${childId}`, data),
  delete: (childId: string, emotionId: string) => api.delete(`/emotions/${childId}/${emotionId}`),
};

export const activitiesApi = {
  getAll: (childId: string, category?: ActivityCategory) =>
    api.get<Activity[]>(`/activities/${childId}`, { params: category ? { category } : {} }),
  add: (childId: string, data: Omit<Activity, '_id' | 'childId' | 'recordedBy' | 'createdAt'>) =>
    api.post<Activity>(`/activities/${childId}`, data),
  delete: (childId: string, activityId: string) =>
    api.delete(`/activities/${childId}/${activityId}`),
};

export const diaryApi = {
  getAll: (childId: string, filters?: { tag?: DiaryTag; author?: string }) =>
    api.get<DiaryEntry[]>(`/diary/${childId}`, { params: filters }),
  add: (childId: string, data: { text: string; tag: DiaryTag; media?: string[] }) =>
    api.post<DiaryEntry>(`/diary/${childId}`, data),
  delete: (childId: string, entryId: string) => api.delete(`/diary/${childId}/${entryId}`),
};

export const milestonesApi = {
  getAll: () => api.get<Milestone[]>('/milestones'),
  getForChild: (childId: string) => api.get<ChildMilestone[]>(`/milestones/${childId}`),
  update: (childId: string, milestoneId: string, status: MilestoneStatus) =>
    api.put<ChildMilestone>(`/milestones/${childId}/${milestoneId}`, { status }),
};

export const recommendationsApi = {
  getAll: (childId: string) => api.get<Recommendation[]>(`/recommendations/${childId}`),
  generate: (childId: string) => api.post<Recommendation>(`/recommendations/${childId}/generate`),
};

export const notificationsApi = {
  getAll: () => api.get<Notification[]>('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const articlesApi = {
  getAll: () => api.get<Article[]>('/articles'),
  getOne: (id: string) => api.get<Article>(`/articles/${id}`),
  create: (data: Partial<Article>) => api.post<Article>('/articles', data),
  update: (id: string, data: Partial<Article>) => api.put<Article>(`/articles/${id}`, data),
  delete: (id: string) => api.delete(`/articles/${id}`),
};

export const adminApi = {
  getUsers: () => api.get<User[]>('/admin/users'),
  getUserDetail: (id: string) => api.get<{ user: User; children: Child[] }>(`/admin/users/${id}`),
  setAdmin: (id: string, isAdmin: boolean) => api.put<User>(`/admin/users/${id}/admin`, { isAdmin }),
  getChildDetail: (childId: string) => api.get<{
    child: Child & { parentId: Pick<User,'_id'|'name'|'email'>; trainers: Pick<User,'_id'|'name'|'email'>[] };
    emotions: Emotion[];
    activities: Activity[];
    diary: DiaryEntry[];
    stats: { totalEmotions: number; totalActivities: number; totalDiary: number };
  }>(`/admin/children/${childId}`),
  getChildAudit: (childId: string) =>
    api.get<(AccessLogEntry & { ip?: string; userId?: { _id: string; name: string; email?: string; role: string } | null })[]>(
      `/admin/children/${childId}/audit`
    ),
};

export const documentsApi = {
  getAll: (childId: string) => api.get<DocumentItem[]>(`/documents/${childId}`),
  // Шаг 1: сервер проверяет тип/размер и выдаёт одноразовую ссылку на загрузку в хранилище
  requestUpload: (childId: string, file: { fileName: string; mimeType: string; size: number }) =>
    api.post<{ documentId: string } & UploadTarget>(`/documents/${childId}/upload-url`, file),
  // Шаг 3: сервер проверяет загруженный файл и сохраняет документ
  completeUpload: (childId: string, documentId: string) =>
    api.post<DocumentItem>(`/documents/${childId}/${documentId}/complete`),
  // Одноразовая ссылка на 5 минут
  getDownloadUrl: (childId: string, documentId: string, inline = true) =>
    api.get<{ url: string; expiresIn: number }>(`/documents/${childId}/${documentId}/download`, {
      params: inline ? { inline: 1 } : {},
    }),
  delete: (childId: string, documentId: string) =>
    api.delete(`/documents/${childId}/${documentId}`),
};

export const tasksApi = {
  getAll: () => api.get<Task[]>('/tasks'),
  getOne: (id: string) => api.get<Task>(`/tasks/${id}`),
  create: (data: Partial<Task>) => api.post<Task>('/tasks', data),
  update: (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  getRatings: (taskId: string) => api.get<TaskRating[]>(`/tasks/${taskId}/ratings`),
  setRating: (taskId: string, childId: string, data: { rating: number; comment?: string }) =>
    api.put<TaskRating>(`/tasks/${taskId}/ratings/${childId}`, data),
  deleteRating: (taskId: string, childId: string) =>
    api.delete(`/tasks/${taskId}/ratings/${childId}`),
  uploadSubmission: (taskId: string, childId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<TaskRating>(`/tasks/${taskId}/submissions/${childId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAllSubmissions: (taskId: string) =>
    api.get<TaskSubmissionAdmin[]>(`/tasks/${taskId}/submissions`),
};

export const enrollmentApi = {
  // Родитель
  createRequest: (data: {
    childId: string; preferredDays: Weekday[]; preferredTimeFrom?: string; preferredTimeTo?: string;
    contactPhone: string; comment?: string;
  }) => api.post<EnrollmentRequest>('/enrollment/requests', data),
  getMyRequests: () => api.get<EnrollmentRequest[]>('/enrollment/requests/my'),
  withdrawRequest: (id: string) => api.put<EnrollmentRequest>(`/enrollment/requests/${id}/withdraw`),

  // Администратор
  adminGetRequests: (status?: RequestStatus) =>
    api.get<{ counts: Record<RequestStatus, number>; requests: EnrollmentRequest[] }>(
      '/enrollment/admin/requests', { params: status ? { status } : {} }
    ),
  adminGetTrainers: () => api.get<User[]>('/enrollment/admin/trainers'),
  adminAssign: (requestId: string, data: {
    trainerId: string; slots: ScheduleSlot[]; durationMin: number; startDate: string; endDate: string;
  }) => api.post<{ assignment: Assignment; sessionsCreated: number; conflicts: number }>(
    `/enrollment/admin/requests/${requestId}/assign`, data
  ),
  adminCancelRequest: (id: string, reason?: string) =>
    api.put<EnrollmentRequest>(`/enrollment/admin/requests/${id}/cancel`, { reason }),
  adminCancelAssignment: (id: string, reason?: string) =>
    api.put<Assignment>(`/enrollment/admin/assignments/${id}/cancel`, { reason }),
  adminCancelSession: (id: string, reason?: string) =>
    api.put<Session>(`/enrollment/admin/sessions/${id}/cancel`, { reason }),

  // Тренер
  activate: (code: string) => api.post<Assignment>('/enrollment/trainer/activate', { code }),
  trainerAssignments: () => api.get<Assignment[]>('/enrollment/trainer/assignments'),

  // Календарь
  getSessions: (from: string, to: string, filters?: { trainerId?: string; childId?: string }) =>
    api.get<Session[]>('/enrollment/sessions', { params: { from, to, ...filters } }),
};
