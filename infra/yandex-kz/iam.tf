# Сервисный аккаунт приложения: только работа с объектами в бакетах этого каталога.
# Каталог должен быть отдельным под UmaiSense — тогда роль на каталог = доступ только к своим бакетам.
resource "yandex_iam_service_account" "app" {
  name        = "umaisense-app"
  description = "API UmaiSense: доступ к бакетам документов и картинок"
}

resource "yandex_resourcemanager_folder_iam_member" "app_storage" {
  folder_id = var.folder_id
  role      = "storage.editor"
  member    = "serviceAccount:${yandex_iam_service_account.app.id}"
}

# Шифрование бакетов ключом KMS: приложению нужно право шифровать/расшифровывать
resource "yandex_resourcemanager_folder_iam_member" "app_kms" {
  folder_id = var.folder_id
  role      = "kms.keys.encrypterDecrypter"
  member    = "serviceAccount:${yandex_iam_service_account.app.id}"
}

# Статический ключ для S3 API — кладётся в /opt/umaisense/.env (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)
resource "yandex_iam_service_account_static_access_key" "app" {
  service_account_id = yandex_iam_service_account.app.id
  description        = "S3-ключ API UmaiSense"
}

# Отдельный аккаунт для бэкапов: пишет только в бакет бэкапов (роль uploader — без удаления)
resource "yandex_iam_service_account" "backup" {
  name        = "umaisense-backup"
  description = "Ежедневные бэкапы базы в бакет бэкапов"
}

resource "yandex_resourcemanager_folder_iam_member" "backup_storage" {
  folder_id = var.folder_id
  role      = "storage.uploader"
  member    = "serviceAccount:${yandex_iam_service_account.backup.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "backup_kms" {
  folder_id = var.folder_id
  role      = "kms.keys.encrypterDecrypter"
  member    = "serviceAccount:${yandex_iam_service_account.backup.id}"
}

resource "yandex_iam_service_account_static_access_key" "backup" {
  service_account_id = yandex_iam_service_account.backup.id
  description        = "S3-ключ для бэкапов"
}
