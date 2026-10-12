provider "yandex" {
  # Регион Казахстан: свои эндпоинты, отдельный биллинг
  endpoint         = "api.yandexcloud.kz:443"
  storage_endpoint = "storage.yandexcloud.kz"
  region_id        = "kz1"
  zone             = var.zone

  cloud_id                 = var.cloud_id
  folder_id                = var.folder_id
  service_account_key_file = var.sa_key_file

  # Статический ключ сервисного аккаунта Terraform — для создания бакетов
  storage_access_key = var.storage_admin_access_key
  storage_secret_key = var.storage_admin_secret_key
}
