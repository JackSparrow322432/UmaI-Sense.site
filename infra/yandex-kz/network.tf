resource "yandex_vpc_network" "main" {
  name = "umaisense"
}

resource "yandex_vpc_subnet" "main" {
  name           = "umaisense-${var.zone}"
  zone           = var.zone
  network_id     = yandex_vpc_network.main.id
  v4_cidr_blocks = ["10.20.0.0/24"]
}

# Постоянный публичный IP сервера (на него указывает A-запись домена)
resource "yandex_vpc_address" "web" {
  name                = "umaisense-web"
  deletion_protection = true

  external_ipv4_address {
    zone_id = var.zone
  }
}
