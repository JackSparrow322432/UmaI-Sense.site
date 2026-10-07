/**
 * Проверка обязательных переменных окружения.
 * В продакшене без JWT_SECRET сервер не работает: с запасным значением любой мог бы
 * подписать себе токен администратора (раньше по умолчанию было 'secret').
 */
const isProd = () => process.env.NODE_ENV === 'production';
let warned = false;

export const getJwtSecret = (): string => {
  const s = process.env.JWT_SECRET;
  if (isProd()) {
    if (!s || s === 'secret') {
      throw new Error('JWT_SECRET is not set — refusing to work in production');
    }
    if (s.length < 32 && !warned) {
      warned = true;
      console.warn('[security] JWT_SECRET is shorter than 32 characters — generate a new one: openssl rand -base64 48');
    }
    return s;
  }
  return s || 'dev-only-secret-do-not-use-in-production';
};

export const assertProductionEnv = (): void => {
  if (!isProd()) return;
  getJwtSecret();
  const missing = ['MONGO_URI', 'CLIENT_URL'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
};
