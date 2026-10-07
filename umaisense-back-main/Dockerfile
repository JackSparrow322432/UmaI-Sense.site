# UmaiSense API — образ для серверов в РК (Freedom Cloud и др.)
# Сборка:  docker build -t umaisense-api .
# Запуск:  docker run --env-file .env -p 5000:5000 umaisense-api

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
# Процесс работает не от root
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health/live >/dev/null || exit 1
# node напрямую (без npm) — чтобы SIGTERM доходил до приложения и работала корректная остановка
CMD ["node", "dist/index.js"]
