variable "cloud_id" {
  description = "ID облака в регионе Казахстан"
  type        = string
}

variable "folder_id" {
  description = "ID каталога (отдельный каталог только под UmaiSense)"
  type        = string
}

variable "sa_key_file" {
  description = "Путь к авторизованному ключу (JSON) сервисного аккаунта Terraform"
  type        = string
  default     = "tf-sa-key.json"
}

variable "storage_admin_access_key" {
  description = "Статический ключ сервисного аккаунта Terraform (для создания бакетов)"
  type        = string
  sensitive   = true
}

variable "storage_admin_secret_key" {
  type      = string
  sensitive = true
}

variable "zone" {
  description = "Зона доступности. В регионе Казахстан одна зона — kz1-a"
  type        = string
  default     = "kz1-a"
}

variable "domain" {
  description = "Домен сайта (A-запись на IP сервера)"
  type        = string
  default     = "app.umaisense.kz"
}

variable "ssh_public_key" {
  description = "Публичный SSH-ключ администратора (содержимое ~/.ssh/id_ed25519.pub)"
  type        = string
}

variable "admin_ip_cidrs" {
  description = "IP-адреса, с которых разрешён SSH (например, [\"203.0.113.10/32\"])"
  type        = list(string)
}

variable "vm_platform_id" {
  description = "Платформа VM (проверьте доступные в kz1: yc compute instance-type list / консоль)"
  type        = string
  default     = "standard-v3"
}

variable "vm_cores" {
  type    = number
  default = 2
}

variable "vm_memory_gb" {
  type    = number
  default = 4
}

variable "vm_core_fraction" {
  description = "Гарантированная доля vCPU, %. 100 — для продакшена; 50 — дешевле"
  type        = number
  default     = 100
}

variable "vm_disk_gb" {
  type    = number
  default = 40
}

variable "image_family" {
  type    = string
  default = "ubuntu-2404-lts"
}

variable "use_managed_mongodb" {
  description = "true — Managed Service for MongoDB в kz1; false — MongoDB в Docker на этой же VM"
  type        = bool
  default     = true
}

variable "mongo_version" {
  type    = string
  default = "6.0"
}

variable "mongo_resource_preset" {
  description = "Класс хоста MongoDB (список: yc managed-mongodb resource-preset list)"
  type        = string
  default     = "s3-c2-m8"
}

variable "mongo_disk_gb" {
  type    = number
  default = 20
}

variable "mongo_password" {
  description = "Пароль пользователя БД umaisense (openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "bucket_prefix" {
  description = "Префикс имён бакетов (имена бакетов глобально уникальны)"
  type        = string
  default     = "umaisense"
}

variable "backup_retention_days" {
  type    = number
  default = 30
}

variable "manage_dns" {
  description = "Создать DNS-зону в Cloud DNS KZ (иначе A-запись создаётся у регистратора .kz)"
  type        = bool
  default     = false
}

variable "dns_zone" {
  description = "Зона DNS (с точкой в конце), если manage_dns = true"
  type        = string
  default     = "umaisense.kz."
}
