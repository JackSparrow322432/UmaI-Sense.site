# Сервер приложения: снаружи открыты только 80/443 (сайт) и 22 (SSH только с IP администратора)
resource "yandex_vpc_security_group" "web" {
  name       = "umaisense-web"
  network_id = yandex_vpc_network.main.id

  ingress {
    description    = "HTTP (редирект на HTTPS, выпуск сертификата Let's Encrypt)"
    protocol       = "TCP"
    port           = 80
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description    = "HTTPS"
    protocol       = "TCP"
    port           = 443
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description    = "SSH — только администратор"
    protocol       = "TCP"
    port           = 22
    v4_cidr_blocks = var.admin_ip_cidrs
  }

  # Исходящий трафик. Внутри облака — всё; наружу — только HTTPS/DNS/NTP/SMTP.
  # HTTPS наружу нужен для: Object Storage KZ (storage.yandexcloud.kz), обновлений ОС и Docker,
  # Let's Encrypt и — пока включён ALLOW_FOREIGN_AI — для OpenAI.
  # Персональные данные уходят только туда, куда их отправляет код; это ограничено проверкой
  # при старте (src/utils/env.ts) и контролируется скриптом scripts/verify-locality.sh.
  egress {
    description    = "Внутренняя сеть"
    protocol       = "ANY"
    v4_cidr_blocks = ["10.20.0.0/24"]
  }

  egress {
    description    = "HTTPS"
    protocol       = "TCP"
    port           = 443
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description    = "HTTP (репозитории пакетов Ubuntu)"
    protocol       = "TCP"
    port           = 80
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description    = "DNS"
    protocol       = "UDP"
    port           = 53
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description    = "NTP"
    protocol       = "UDP"
    port           = 123
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description    = "SMTP submission (почтовый провайдер в РК)"
    protocol       = "TCP"
    from_port      = 465
    to_port        = 587
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

# База данных: доступ только с сервера приложения, порт Managed MongoDB — 27018
resource "yandex_vpc_security_group" "mongo" {
  count      = var.use_managed_mongodb ? 1 : 0
  name       = "umaisense-mongo"
  network_id = yandex_vpc_network.main.id

  ingress {
    description       = "MongoDB только с сервера приложения"
    protocol          = "TCP"
    port              = 27018
    security_group_id = yandex_vpc_security_group.web.id
  }
}
