# UmaiSense — инфраструктура в Yandex Cloud, регион Казахстан (kz1, зона kz1-a).
# Все ресурсы создаются только в этом регионе: эндпоинты API и Object Storage — *.yandexcloud.kz.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = ">= 0.140.0"
    }
  }

  # Состояние Terraform — в бакете Object Storage KZ (не локально и не в Terraform Cloud):
  # в нём есть пароли и ключи. Бакет создаётся заранее скриптом scripts/bootstrap-state.sh.
  # Параметры — в backend.hcl (см. backend.hcl.example): tofu init -backend-config=backend.hcl
  backend "s3" {
    endpoints = {
      s3 = "https://storage.yandexcloud.kz"
    }
    region                      = "kz1"
    key                         = "umaisense/terraform.tfstate"
    skip_region_validation      = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}
