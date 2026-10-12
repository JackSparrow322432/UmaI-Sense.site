#!/usr/bin/env bash
# Перенос файлов из Cloudinary (и старой папки uploads) в бакеты Yandex Object Storage KZ.
# Запускается НА СЕРВЕРЕ после migrate-from-atlas.sh. Использует скрипт приложения
# src/scripts/migrate-files-to-s3.ts из стадии сборки образа (там есть devDependencies).
#
#   export CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
#   ./migrate-files.sh --dry-run   # пробный прогон: только список
#   ./migrate-files.sh             # перенос (идемпотентный, можно повторять)
#
# CLOUDINARY_* передаются ТОЛЬКО в этот одноразовый контейнер и не попадают в .env приложения
# (в production приложение откажется стартовать, если увидит CLOUDINARY_*).
# Файлы в Cloudinary НЕ удаляются — владелец удаляет их вручную после проверки.
set -euo pipefail

ROOT=/opt/umaisense
: "${CLOUDINARY_CLOUD_NAME:?}"; : "${CLOUDINARY_API_KEY:?}"; : "${CLOUDINARY_API_SECRET:?}"
NET=host
docker compose -f "$ROOT/docker-compose.yml" ps --services 2>/dev/null | grep -qx mongo && NET=umaisense_default

docker build -q --target build -t umaisense-api-build "$ROOT/src/umaisense-back-main" >/dev/null
docker run --rm --network "$NET" --env-file "$ROOT/.env" -e NODE_ENV=migration \
  -e CLOUDINARY_CLOUD_NAME -e CLOUDINARY_API_KEY -e CLOUDINARY_API_SECRET \
  -v "$ROOT/certs":/certs:ro \
  umaisense-api-build npm run migrate:files -- "$@"
