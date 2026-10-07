import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp, connectDB } from './createApp';
import { assertProductionEnv } from './utils/env';
import { sweepAbandonedUploads } from './controllers/documents.controller';

/**
 * Точка входа для постоянного сервера (VM / Docker / Kubernetes в РК).
 * Тот же createApp(), что и в serverless-версии (api/index.ts), — одна логика на оба режима.
 */

assertProductionEnv();

const app = createApp();
const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  // Держим соединения дольше, чем таймаут простоя балансировщика (обычно 60 с) — иначе редкие 502
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // Каждые 15 минут удаляем брошенные загрузки документов (запись + файл в хранилище)
  const sweeper = setInterval(() => {
    sweepAbandonedUploads().catch((err) => console.error('[sweep] failed:', err));
  }, 15 * 60 * 1000);
  sweeper.unref();

  // Корректная остановка при деплое/перезапуске: дорабатываем текущие запросы, закрываем БД
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      console.log('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));

start().catch((err: Error) => {
  console.error('Startup error:', err.message);
  process.exit(1);
});
