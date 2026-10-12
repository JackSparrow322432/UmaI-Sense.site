data "yandex_compute_image" "ubuntu" {
  family = var.image_family
}

# Сервер приложения: nginx (HTTPS, сайт, /api, /media) + API в Docker (+ MongoDB, если не managed)
resource "yandex_compute_instance" "web" {
  name                      = "umaisense-web"
  hostname                  = "umaisense-web"
  platform_id               = var.vm_platform_id
  zone                      = var.zone
  allow_stopping_for_update = true

  resources {
    cores         = var.vm_cores
    memory        = var.vm_memory_gb
    core_fraction = var.vm_core_fraction
  }

  boot_disk {
    initialize_params {
      image_id   = data.yandex_compute_image.ubuntu.id
      size       = var.vm_disk_gb
      type       = "network-ssd"
      kms_key_id = yandex_kms_symmetric_key.data.id # диск зашифрован ключом KMS
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.main.id
    nat                = true
    nat_ip_address     = yandex_vpc_address.web.external_ipv4_address[0].address
    security_group_ids = [yandex_vpc_security_group.web.id]
  }

  metadata = {
    user-data          = templatefile("${path.module}/cloud-init.yaml", { ssh_public_key = var.ssh_public_key })
    serial-port-enable = "0"
  }

  scheduling_policy {
    preemptible = false
  }

  lifecycle {
    ignore_changes = [boot_disk[0].initialize_params[0].image_id, metadata["user-data"]]
  }
}
