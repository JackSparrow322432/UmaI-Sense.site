#!/usr/bin/env bash
# Ежедневный бэкап: MongoDB (с SECONDARY, без нагрузки на PRIMARY) + файлы из Garage
# → хранилище бэкапов в ДРУГОМ ЦОД в РК (rclone-ремоут "backup:").
#
# cron на data3:  15 2 * * *  /opt/umaisense/deploy/backup/backup.sh >> /var/log/umaisense-backup.log 2>&1
#
# Нужно: mongodump (mongodb-database-tools), rclone с ремоутами:
#   garage:  — S3 Garage (http://10.10.0.5:3900, ключ только на чтение)
#   backup:  — хранилище бэкапов (S3 в другом ЦОД Freedom Cloud или другого провайдера в РК)
# Секреты — в /opt/umaisense/backup.env (chmod 600): MONGO_BACKUP_URI, BACKUP_ENCRYPTION_KEY
set -euo pipefail
# set -a: переменные из файла экспортируются (openssl читает ключ через env:)
set -a; source /opt/umaisense/backup.env; set +a

STAMP=$(date +%Y-%m-%d_%H%M)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "[$(date)] MongoDB dump…"
mongodump --uri="$MONGO_BACKUP_URI" --readPreference=secondary --oplog --gzip \
  --archive="$TMP/mongo-$STAMP.archive.gz"

# Шифруем перед отправкой: в бэкапе ИИН и медицинские данные
openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$TMP/mongo-$STAMP.archive.gz" -out "$TMP/mongo-$STAMP.archive.gz.enc"

rclone copy "$TMP/mongo-$STAMP.archive.gz.enc" backup:umaisense-backups/mongo/
# Храним 30 дней
rclone delete backup:umaisense-backups/mongo/ --min-age 30d

echo "[$(date)] Files sync…"
# Удалённые/изменённые файлы не пропадают сразу, а переносятся в папку с датой (30 дней)
for b in umaisense-documents umaisense-public; do
  rclone sync "garage:$b" "backup:umaisense-backups/files/$b" \
    --backup-dir "backup:umaisense-backups/files-deleted/$STAMP/$b" --fast-list
done
rclone delete backup:umaisense-backups/files-deleted/ --min-age 30d --rmdirs

echo "[$(date)] Done"
