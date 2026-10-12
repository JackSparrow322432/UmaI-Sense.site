import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 на /auth/* (неверный пароль, код) — это обычная ошибка формы: не перезагружаем страницу,
    // иначе сообщение «Неверный пароль» терялось из-за редиректа
    const url = String(error.config?.url ?? '');
    if (error.response?.status === 401 && !url.startsWith('/auth/login') && !url.includes('/auth/verify') && !url.includes('/auth/reset')) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
