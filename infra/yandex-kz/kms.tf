# Ключ шифрования для бакетов и диска сервера (KMS доступен в регионе KZ: cpl.kms.api.yandexcloud.kz)
resource "yandex_kms_symmetric_key" "data" {
  name                = "umaisense-data"
  description         = "Шифрование документов, бэкапов и диска сервера"
  default_algorithm   = "AES_256"
  rotation_period     = "8760h" # ротация раз в год
  deletion_protection = true

  lifecycle {
    prevent_destroy = true
  }
}
