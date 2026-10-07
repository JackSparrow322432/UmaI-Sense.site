#!/usr/bin/env bash
# Перенос базы из MongoDB Atlas в кластер в РК. Выполнять в окно обслуживания (≈15–30 минут).
#
# 1. На Vercel включить режим обслуживания или временно остановить запись (см. DEPLOY_FREEDOM_CLOUD.md).
# 2. Запустить этот скрипт с app1 (у него есть доступ и к Atlas, и к новой базе).
# 3. Проверить количество документов, переключить фронтенд на новый API.
#
# ATLAS_URI=…  NEW_URI=…  ./deploy/migrate-from-atlas.sh
set -euo pipefail
: "${ATLAS_URI:?Укажите ATLAS_URI}"
: "${NEW_URI:?Укажите NEW_URI (пользователь с правами на umai_sense)}"
# Имя базы в Atlas (последняя часть пути в MONGO_URI на Vercel). В новой базе — umai_sense.
SRC_DB="${SRC_DB:-umai_sense}"
DST_DB="umai_sense"
DUMP=$(mktemp -d)
trap 'rm -rf "$DUMP"' EXIT   # дамп содержит персональные данные — удаляем сразу

mongodump --uri="$ATLAS_URI" --db="$SRC_DB" --gzip --archive="$DUMP/atlas.archive.gz"
mongorestore --uri="$NEW_URI" --gzip --archive="$DUMP/atlas.archive.gz" \
  --nsInclude="$SRC_DB.*" --nsFrom="$SRC_DB.*" --nsTo="$DST_DB.*" --drop --writeConcern='{w:"majority"}'

echo "Сверка количества документов:"
for c in users children documents enrollmentrequests assignments sessions emotions activities diaryentries; do
  a=$(mongosh "$ATLAS_URI" --quiet --eval "db.getSiblingDB('$SRC_DB').$c.countDocuments()")
  n=$(mongosh "$NEW_URI"   --quiet --eval "db.getSiblingDB('$DST_DB').$c.countDocuments()")
  printf '  %-20s atlas=%-8s new=%-8s %s\n' "$c" "$a" "$n" "$([ "$a" = "$n" ] && echo ✓ || echo ✗)"
done

echo
echo "ВАЖНО: --drop пересоздал коллекции с индексами из Atlas. Перезапустите приложение,"
echo "чтобы создались новые индексы (уникальные, TTL и т.д.):"
echo "  на app1 и app2: docker compose -f deploy/app/docker-compose.yml restart"
