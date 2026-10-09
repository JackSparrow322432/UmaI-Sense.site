#!/usr/bin/env bash
# Перенос базы из MongoDB Atlas в MongoDB в Yandex Cloud KZ (Managed или контейнер на ВМ).
# Запускается НА СЕРВЕРЕ в окно работ (сайт на старом хостинге переведён в режим «только чтение»
# или остановлен — иначе записи, сделанные во время переноса, потеряются).
#
#   ATLAS_URI='mongodb+srv://user:pass@cluster.mongodb.net/umai_sense' ./migrate-from-atlas.sh
#
# Целевая база берётся из MONGO_URI в /opt/umaisense/.env. Дамп хранится только на этой ВМ
# (каталог 700) и удаляется в конце. Atlas НЕ удаляется — это делает владелец вручную позже.
set -euo pipefail

ROOT=/opt/umaisense
: "${ATLAS_URI:?укажите ATLAS_URI (строка подключения к Atlas)}"
. "$(dirname "$(readlink -f "$0")")/lib.sh"; load_env "$ROOT/.env"
: "${MONGO_URI:?нет MONGO_URI в .env}"
DB="${DB_NAME:-umai_sense}"
WORK=$(mktemp -d "$ROOT/migrate.XXXXXX"); chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT

NET_ARGS=(--network host)
# Если MongoDB в контейнере compose — подключаемся из той же сети
if docker compose -f "$ROOT/docker-compose.yml" ps --services 2>/dev/null | grep -qx mongo; then
  NET_ARGS=(--network umaisense_default)
fi
TOOLS=(docker run --rm "${NET_ARGS[@]}" -v "$WORK":/dump -v "$ROOT/certs":/certs:ro mongo:7.0)

echo "==> Дамп из Atlas"
"${TOOLS[@]}" mongodump --uri="$ATLAS_URI" --db="$DB" --out=/dump --gzip

echo "==> Восстановление в Yandex Cloud KZ"
"${TOOLS[@]}" mongorestore --uri="$MONGO_URI" --nsInclude="$DB.*" --gzip --drop /dump

echo "==> Сверка количества документов по коллекциям"
COUNT_JS='const d=db.getSiblingDB("'"$DB"'"); const r={}; d.getCollectionNames().sort().forEach(c=>r[c]=d.getCollection(c).countDocuments()); print(JSON.stringify(r));'
SRC_COUNTS=$("${TOOLS[@]}" mongosh "$ATLAS_URI" --quiet --eval "$COUNT_JS")
DST_COUNTS=$("${TOOLS[@]}" mongosh "$MONGO_URI" --quiet --eval "$COUNT_JS")
echo "Atlas:  $SRC_COUNTS"
echo "KZ:     $DST_COUNTS"
if [ "$SRC_COUNTS" = "$DST_COUNTS" ]; then
  echo "OK: количество документов совпадает."
else
  echo "ВНИМАНИЕ: количество отличается. Не переключайте DNS, разберитесь с расхождением."; exit 1
fi
