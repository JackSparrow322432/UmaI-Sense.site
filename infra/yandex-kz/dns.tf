# DNS в Cloud DNS KZ (необязательно). Иначе создайте у регистратора .kz A-запись: домен → output web_ip
resource "yandex_dns_zone" "main" {
  count  = var.manage_dns ? 1 : 0
  name   = "umaisense"
  zone   = var.dns_zone
  public = true
}

resource "yandex_dns_recordset" "app" {
  count   = var.manage_dns ? 1 : 0
  zone_id = yandex_dns_zone.main[0].id
  name    = "${var.domain}."
  type    = "A"
  ttl     = 300
  data    = [yandex_vpc_address.web.external_ipv4_address[0].address]
}
