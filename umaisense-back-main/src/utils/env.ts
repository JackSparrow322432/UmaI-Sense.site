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

// ─── Локальность данных: всё в Казахстане ───────────────────────────────────

/** Частные адреса (внутренняя сеть облака) и localhost */
const isPrivateHost = (h: string) =>
  h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
  /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
  /\.internal$/.test(h) || /^[a-z0-9-]+$/.test(h); // имя сервиса в docker-сети (mongo, garage…)

/**
 * Разрешённые хосты для базы, хранилища и почты: Yandex Cloud регион Казахстан (*.yandexcloud.kz),
 * внутренняя сеть, а также явно перечисленные в LOCALITY_ALLOWED_HOSTS (через запятую) —
 * например, почтовый провайдер в РК.
 */
const extraHosts = () =>
  (process.env.LOCALITY_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

export const isKzHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return /(^|\.)yandexcloud\.kz$/.test(h) || isPrivateHost(h) ||
    extraHosts().some((x) => h === x || h.endsWith(`.${x}`));
};

const hostsFromMongoUri = (uri: string): string[] => {
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/);
  return m ? m[1].split(',').map((x) => x.replace(/:\d+$/, '')) : [];
};
const hostOf = (url?: string) => {
  try { return url ? new URL(url).hostname : ''; } catch { return ''; }
};

/**
 * Проверки при старте в production. Сервер НЕ запускается, если данные могут уйти за пределы РК:
 * база не в Казахстане (например, MongoDB Atlas), хранилище не Yandex Object Storage KZ,
 * заданы ключи Cloudinary, почта через зарубежный сервис, зарубежный ИИ без ALLOW_FOREIGN_AI=true.
 */
export const assertProductionEnv = (): void => {
  if (!isProd()) return;
  getJwtSecret();
  const missing = ['MONGO_URI', 'CLIENT_URL', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
    'S3_PRIVATE_BUCKET', 'S3_PUBLIC_BUCKET', 'S3_PUBLIC_URL'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Не заданы обязательные переменные: ${missing.join(', ')}`);

  const problems: string[] = [];
  const mongoHosts = hostsFromMongoUri(process.env.MONGO_URI as string);
  if (!mongoHosts.length) problems.push('MONGO_URI: не удалось разобрать адрес базы');
  for (const h of mongoHosts) {
    if (/mongodb\.net$/.test(h)) problems.push(`MONGO_URI указывает на MongoDB Atlas (${h}) — база должна быть в Казахстане`);
    else if (!isKzHost(h)) problems.push(`MONGO_URI: хост ${h} не в Yandex Cloud KZ и не во внутренней сети`);
  }
  for (const k of ['S3_ENDPOINT', 'S3_PUBLIC_ENDPOINT', 'S3_PUBLIC_URL']) {
    const v = process.env[k];
    if (!v) continue;
    const h = hostOf(v);
    // S3_PUBLIC_URL может указывать на свой домен (nginx /media, проксирующий бакет в KZ)
    const ownDomain = h && h === hostOf(process.env.CLIENT_URL);
    if (!h || (!isKzHost(h) && !ownDomain)) problems.push(`${k}=${v}: хранилище должно быть Yandex Object Storage KZ (storage.yandexcloud.kz) или внутренняя сеть`);
  }
  if (Object.keys(process.env).some((k) => k.startsWith('CLOUDINARY_') && process.env[k])) {
    problems.push('Заданы переменные CLOUDINARY_* — Cloudinary (за рубежом) больше не используется; удалите их из .env');
  }
  const smtp = (process.env.SMTP_HOST || '').toLowerCase();
  if (/gmail|googlemail|sendgrid|mailgun|brevo|sendinblue|outlook|office365|amazonaws|mailjet|zoho/.test(smtp)) {
    problems.push(`SMTP_HOST=${smtp}: зарубежный почтовый сервис — используйте почтовый хостинг в РК и добавьте его в LOCALITY_ALLOWED_HOSTS`);
  } else if (smtp && !isKzHost(smtp)) {
    problems.push(`SMTP_HOST=${smtp}: добавьте почтовый сервер в LOCALITY_ALLOWED_HOSTS, если он находится в РК`);
  }
  const ai = (process.env.AI_SCREENING_PROVIDER || 'off').toLowerCase();
  const aiInKz = ai === 'off' || ai === 'local' ||
    (ai === 'yandex' && /(^|\.)yandexcloud\.kz$/.test(hostOf(process.env.AI_YANDEX_BASE_URL)));
  if (!aiInKz && process.env.ALLOW_FOREIGN_AI !== 'true') {
    problems.push(`AI_SCREENING_PROVIDER=${ai}: ИИ обрабатывает данные за пределами РК. Выключите ИИ (off) или явно разрешите ALLOW_FOREIGN_AI=true (нужны согласия родителей на трансграничную передачу)`);
  }
  if (problems.length) {
    throw new Error(`Конфигурация нарушает требование «данные только в Казахстане»:\n  • ${problems.join('\n  • ')}`);
  }
  // Без почты сервер работает (вход по паролю), но регистрация и восстановление пароля недоступны
  if (!smtp) console.warn('[email] SMTP_HOST не задан — письма с кодами не отправляются: регистрация и сброс пароля недоступны');
  if (!aiInKz) console.warn(`[locality] Внимание: ИИ-провайдер ${ai} работает за пределами РК (ALLOW_FOREIGN_AI=true)`);
};
