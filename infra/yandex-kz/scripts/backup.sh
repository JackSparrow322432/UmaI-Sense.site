#!/usr/bin/env bash
# Ежедневная зашифрованная резервная копия базы в бакет backups (Yandex Object Storage KZ).
# Для Managed MongoDB это ДОПОЛНЕНИЕ к встроенным бэкапам кластера; для MongoDB в контейнере — основной бэкап.
#
# Установка (на сервере):
#   age-keygen -o ~/backup-key.txt   # ключ ХРАНИТЕ ОФЛАЙН, на сервере оставьте только публичную часть
#   echo 'BACKUP_AGE_RECIPIENT=age1...' >> /opt/umaisense/.env  (+ значения из: tofu output -raw backup_env)
#   (crontab -l; echo '40 2 * * * /opt/umaisense/src/infra/yandex-kz/scripts/backup.sh >> /opt/umaisense/backup.log 2>&1') | crontab -
#
# Восстановление: скачать файл из бакета, `age -d -i backup-key.txt dump.gz.age > dump.gz`,
#   docker run --rm -i mongo:7.0 mongorestore --uri="$MONGO_URI" --archive --gzip --drop < dump.gz
set -euo pipefail

ROOT=/opt/umaisense
. "$(dirname "$(readlink -f "$0")")/lib.sh"; load_env "$ROOT/.env"
: "${MONGO_URI:?}"; : "${BACKUP_BUCKET:?}"; : "${BACKUP_S3_ACCESS_KEY_ID:?}"; : "${BACKUP_S3_SECRET_ACCESS_KEY:?}"
: "${BACKUP_AGE_RECIPIENT:?укажите публичный ключ age}"

NET=host
docker compose -f "$ROOT/docker-compose.yml" ps --services 2>/dev/null | grep -qx mongo && NET=umaisense_default
NAME="mongo/$(date -u +%Y/%m/%d)/umai_sense-$(date -u +%Y%m%dT%H%M%SZ).archive.gz.age"
TMP=$(mktemp "$ROOT/backup.XXXXXX"); trap 'rm -f "$TMP"' EXIT

docker run --rm --network "$NET" -v "$ROOT/certs":/certs:ro mongo:7.0 \
  mongodump --uri="$MONGO_URI" --archive --gzip | age -r "$BACKUP_AGE_RECIPIENT" > "$TMP"

docker run --rm -v "$TMP":/data/backup:ro \
  -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=kz1 amazon/aws-cli:2.17.0 \
  --endpoint-url https://storage.yandexcloud.kz s3 cp /data/backup "s3://$BACKUP_BUCKET/$NAME"

echo "$(date -u +%FT%TZ) backup ok: s3://$BACKUP_BUCKET/$NAME ($(stat -c %s "$TMP") bytes)"
