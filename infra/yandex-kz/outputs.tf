output "web_ip" {
  description = "Публичный IP сервера — A-запись домена"
  value       = yandex_vpc_address.web.external_ipv4_address[0].address
}

output "ssh" {
  value = "ssh umaisense@${yandex_vpc_address.web.external_ipv4_address[0].address}"
}

output "mongo_hosts" {
  description = "Хосты Managed MongoDB (порт 27018, TLS)"
  value       = var.use_managed_mongodb ? [for h in yandex_mdb_mongodb_cluster.main[0].host : h.name] : []
}

output "buckets" {
  value = {
    documents = yandex_storage_bucket.documents.bucket
    public    = yandex_storage_bucket.public.bucket
    backups   = yandex_storage_bucket.backups.bucket
  }
}

# Значения для /opt/umaisense/.env — выводятся только по запросу: tofu output -raw app_env
output "app_env" {
  sensitive = true
  value     = <<-EOT
    MONGO_URI=${var.use_managed_mongodb ? "mongodb://umaisense:${var.mongo_password}@${join(",", [for h in yandex_mdb_mongodb_cluster.main[0].host : "${h.name}:27018"])}/umai_sense?tls=true&tlsCAFile=/certs/root.crt&authSource=umai_sense" : "mongodb://umaisense:${var.mongo_password}@mongo:27017/umai_sense?authSource=admin"}
    S3_ENDPOINT=https://storage.yandexcloud.kz
    S3_REGION=kz1
    S3_ACCESS_KEY_ID=${yandex_iam_service_account_static_access_key.app.access_key}
    S3_SECRET_ACCESS_KEY=${yandex_iam_service_account_static_access_key.app.secret_key}
    S3_PRIVATE_BUCKET=${yandex_storage_bucket.documents.bucket}
    S3_PUBLIC_BUCKET=${yandex_storage_bucket.public.bucket}
    S3_PUBLIC_URL=https://${var.domain}/media
    CLIENT_URL=https://${var.domain}
    DOMAIN=${var.domain}
    USE_LOCAL_MONGO=${var.use_managed_mongodb ? "false" : "true"}
  EOT
}

output "backup_env" {
  sensitive = true
  value     = <<-EOT
    BACKUP_BUCKET=${yandex_storage_bucket.backups.bucket}
    BACKUP_S3_ACCESS_KEY_ID=${yandex_iam_service_account_static_access_key.backup.access_key}
    BACKUP_S3_SECRET_ACCESS_KEY=${yandex_iam_service_account_static_access_key.backup.secret_key}
  EOT
}
