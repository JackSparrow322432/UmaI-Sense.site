# Managed Service for MongoDB в регионе Казахстан (API: mdb.api.yandexcloud.kz).
# Если сервис недоступен в вашем аккаунте — use_managed_mongodb = false, и база поднимается
# в Docker на сервере приложения (app/docker-compose.yml, профиль mongo).
resource "yandex_mdb_mongodb_cluster" "main" {
  count               = var.use_managed_mongodb ? 1 : 0
  name                = "umaisense"
  environment         = "PRODUCTION"
  network_id          = yandex_vpc_network.main.id
  security_group_ids  = [yandex_vpc_security_group.mongo[0].id]
  deletion_protection = true

  cluster_config {
    version = var.mongo_version

    backup_window_start {
      hours   = 21 # 03:00 по Алматы
      minutes = 0
    }
  }

  database {
    name = "umai_sense"
  }

  user {
    name     = "umaisense"
    password = var.mongo_password
    permission {
      database_name = "umai_sense"
      roles         = ["readWrite"]
    }
  }

  resources_mongod {
    resource_preset_id = var.mongo_resource_preset
    disk_size          = var.mongo_disk_gb
    disk_type_id       = "network-ssd"
  }

  # Одна зона в регионе KZ: для отказоустойчивости хостов можно добавить ещё host-блоки в kz1-a
  host {
    zone_id   = var.zone
    subnet_id = yandex_vpc_subnet.main.id
  }

  maintenance_window {
    type = "WEEKLY"
    day  = "SUN"
    hour = 22 # 04:00 по Алматы (UTC+6)
  }
}
