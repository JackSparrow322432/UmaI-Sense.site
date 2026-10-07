# Проверка восстановления (раз в месяц)

Бэкап, который ни разу не восстанавливали, — это не бэкап.

1. Поднять временную MongoDB (на отдельной ВМ или локально в Docker).
2. Скачать последний архив и расшифровать:
   ```bash
   rclone copy backup:umaisense-backups/mongo/mongo-YYYY-MM-DD_HHMM.archive.gz.enc .
   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
     -in mongo-….archive.gz.enc -out restore.archive.gz
   mongorestore --uri="mongodb://localhost:27017" --gzip --archive=restore.archive.gz --oplogReplay
   ```
3. Проверить: число пользователей, детей, документов совпадает с продом (±за сутки).
4. Открыть 2–3 случайных документа из `backup:umaisense-backups/files/umaisense-documents`.
5. Записать дату и результат в журнал проверок. Удалить временную копию — в ней персональные данные.
