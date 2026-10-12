# ─── Бакеты Object Storage (регион Казахстан) ──────────────────────────────────

# Закрытый бакет медицинских документов: доступ только по подписанной ссылке на 5 минут,
# шифрование KMS, версионирование (защита от случайного удаления), CORS — только свой домен.
resource "yandex_storage_bucket" "documents" {
  bucket    = "${var.bucket_prefix}-documents"
  folder_id = var.folder_id

  anonymous_access_flags {
    read        = false
    list        = false
    config_read = false
  }

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = yandex_kms_symmetric_key.data.id
        sse_algorithm     = "aws:kms"
      }
    }
  }

  # Браузер загружает и открывает документы напрямую по подписанной ссылке
  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = ["https://${var.domain}"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    id                                     = "cleanup"
    enabled                                = true
    abort_incomplete_multipart_upload_days = 1

    # Удалённые документы (старые версии) окончательно стираются через 30 дней
    noncurrent_version_expiration {
      days = 30
    }
  }
}

# Картинки интерфейса (фото профилей, обложки): чтение без авторизации, но без списка файлов.
# Раздаются через nginx того же домена: https://app.umaisense.kz/media/...
resource "yandex_storage_bucket" "public" {
  bucket    = "${var.bucket_prefix}-public"
  folder_id = var.folder_id

  anonymous_access_flags {
    read        = true
    list        = false
    config_read = false
  }
}

# Бэкапы базы: закрыто, шифрование KMS, версионирование, автоудаление по сроку хранения
resource "yandex_storage_bucket" "backups" {
  bucket    = "${var.bucket_prefix}-backups"
  folder_id = var.folder_id

  anonymous_access_flags {
    read        = false
    list        = false
    config_read = false
  }

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = yandex_kms_symmetric_key.data.id
        sse_algorithm     = "aws:kms"
      }
    }
  }

  lifecycle_rule {
    id      = "retention"
    enabled = true

    expiration {
      days = var.backup_retention_days
    }

    noncurrent_version_expiration {
      days = 7
    }
  }
}
