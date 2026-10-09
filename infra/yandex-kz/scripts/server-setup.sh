#!/usr/bin/env bash
# Первичная настройка сервера, созданного вручную в консоли Yandex Cloud KZ (без Terraform).
# Делает то же, что cloud-init.yaml: Docker, межсетевой экран, fail2ban, автообновления,
# вход только по ключу, каталог /opt/umaisense.
#
#   sudo /opt/umaisense/src/infra/yandex-kz/scripts/server-setup.sh
# После выполнения выйдите из SSH и зайдите снова (чтобы заработала группа docker).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Запустите через sudo"; exit 1; }
APP_USER="${SUDO_USER:-umaisense}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git unattended-upgrades fail2ban ufw jq age conntrack

# Docker из официального репозитория (только установка пакетов)
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'J'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" }, "live-restore": true }
J
systemctl enable docker >/dev/null && systemctl restart docker
usermod -aG docker "$APP_USER"

# SSH только по ключу
cat > /etc/ssh/sshd_config.d/90-umaisense.conf <<'C'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 3
C
systemctl restart ssh

# Автообновления безопасности и защита от перебора паролей
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades
printf '[sshd]\nenabled = true\nmaxretry = 5\nbantime = 1h\n' > /etc/fail2ban/jail.d/sshd.local
systemctl enable --now fail2ban >/dev/null

# Межсетевой экран (дополнительно к группе безопасности в облаке)
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

timedatectl set-timezone Asia/Almaty || true
mkdir -p /opt/umaisense/certs /opt/umaisense/certbot/www /opt/umaisense/certbot/conf
chown -R "$APP_USER:$APP_USER" /opt/umaisense
chmod 750 /opt/umaisense

echo
echo "Готово. Выйдите (exit) и зайдите по SSH снова, затем создайте /opt/umaisense/.env и запустите deploy.sh."
