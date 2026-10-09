#!/usr/bin/env bash
# Выкладка UmaiSense на ВМ в Yandex Cloud (kz1). Запускается НА СЕРВЕРЕ:
#   ssh umaisense@<web_ip>
#   /opt/umaisense/src/infra/yandex-kz/scripts/deploy.sh [git-ref]
#
# Первый запуск: склонируйте репозиторий в /opt/umaisense/src и положите /opt/umaisense/.env
# (значения: tofu output -raw app_env или из консоли + JWT_SECRET + SMTP + AI).
# Режим HTTPS: DOMAIN — доменное имя, сертификат Let's Encrypt выпускается автоматически.
# Режим без домена: DOMAIN — IP-адрес сервера (или HTTPS=false) — только HTTP, для проверки.
# Сборка идёт на сервере: исходники берутся из git, секреты — только из /opt/umaisense/.env.
set -euo pipefail

ROOT=/opt/umaisense
SRC=$ROOT/src
APP=$SRC/infra/yandex-kz/app
cd "$ROOT"

[ -f "$ROOT/.env" ] || { echo "Нет $ROOT/.env — см. DEPLOY_YANDEX_CLOUD_KZ.md"; exit 1; }
chmod 600 "$ROOT/.env"
. "$(dirname "$(readlink -f "$0")")/lib.sh"; load_env "$ROOT/.env"
REF="${1:-${DEPLOY_REF:-main}}"
: "${DOMAIN:?в .env нужен DOMAIN: доменное имя или IP-адрес сервера}"

if [[ "$DOMAIN" =~ ^[0-9.]+$ ]] || [ "${HTTPS:-true}" = "false" ]; then
  TLS=false; SCHEME=http
  echo "!! Режим без HTTPS (DOMAIN=$DOMAIN): данные передаются без шифрования — только для проверки."
else
  TLS=true; SCHEME=https
  : "${LETSENCRYPT_EMAIL:?в .env нужен LETSENCRYPT_EMAIL для сертификата}"
fi

if [ -z "${DEPLOY_REEXEC:-}" ]; then
  echo "==> Обновляю исходники ($REF)"
  git -C "$SRC" fetch --prune origin
  git -C "$SRC" checkout -q "$REF"
  git -C "$SRC" reset -q --hard "origin/$REF" 2>/dev/null || git -C "$SRC" reset -q --hard "$REF"
  # Перезапуск уже обновлённой версии этого скрипта
  DEPLOY_REEXEC=1 exec "$SRC/infra/yandex-kz/scripts/deploy.sh" "$REF"
fi
VERSION=$(git -C "$SRC" rev-parse --short HEAD)
export APP_VERSION="$VERSION"

echo "==> Конфигурация compose и nginx"
install -m 644 "$APP/docker-compose.yml" "$ROOT/docker-compose.yml"
mkdir -p "$ROOT/nginx/templates" "$ROOT/certs" "$ROOT/certbot/www" "$ROOT/certbot/conf"
if [ "$TLS" = true ]; then
  install -m 644 "$APP/nginx/templates/default.conf.template" "$ROOT/nginx/templates/default.conf.template"
else
  install -m 644 "$APP/nginx/http.conf.template" "$ROOT/nginx/templates/default.conf.template"
fi
# Корневой сертификат Yandex Cloud — для TLS-подключения к Managed MongoDB
if [ ! -s "$ROOT/certs/root.crt" ]; then
  curl -fsSL https://storage.yandexcloud.kz/cloud-certs/CA.pem -o "$ROOT/certs/root.crt" 2>/dev/null \
    || curl -fsSL https://storage.yandexcloud.net/cloud-certs/CA.pem -o "$ROOT/certs/root.crt"
fi

echo "==> Проверка локальности .env"
"$SRC/infra/yandex-kz/scripts/verify-locality.sh" --env-only

echo "==> Сборка фронтенда (в контейнере Node, VITE_API_URL=/api)"
docker run --rm -v "$SRC/umiasense-front-main":/w -w /w -e VITE_API_URL=/api node:22-alpine \
  sh -c "npm ci --no-audit --no-fund && npm run build"
rm -rf "$ROOT/frontend.new" && cp -r "$SRC/umiasense-front-main/dist" "$ROOT/frontend.new"
rm -rf "$ROOT/frontend.old" && { [ -d "$ROOT/frontend" ] && mv "$ROOT/frontend" "$ROOT/frontend.old" || true; }
mv "$ROOT/frontend.new" "$ROOT/frontend"

echo "==> Сборка API ($VERSION)"
PROFILE_ARGS=()
[ "${USE_LOCAL_MONGO:-false}" = "true" ] && PROFILE_ARGS=(--profile mongo)
docker compose "${PROFILE_ARGS[@]}" build api

if [ "$TLS" = true ] && [ ! -f "$ROOT/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "==> Первый выпуск сертификата Let's Encrypt для $DOMAIN (DNS уже должен указывать на этот сервер)"
  docker rm -f umaisense-bootstrap >/dev/null 2>&1 || true
  docker run -d --name umaisense-bootstrap -p 80:80 \
    -v "$APP/nginx/bootstrap-http.conf":/etc/nginx/conf.d/default.conf:ro \
    -v "$ROOT/certbot/www":/var/www/certbot:ro nginx:1.27-alpine >/dev/null
  docker run --rm -v "$ROOT/certbot/www":/var/www/certbot -v "$ROOT/certbot/conf":/etc/letsencrypt \
    certbot/certbot:v2.11.0 certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email --non-interactive
  docker rm -f umaisense-bootstrap >/dev/null
fi

echo "==> Запуск"
docker compose "${PROFILE_ARGS[@]}" up -d --remove-orphans
docker compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true

echo "==> Ожидание готовности API"
for i in $(seq 1 30); do
  # Проверяем через localhost: обращение ВМ к собственному публичному IP может не проходить
  if { [ "$TLS" = true ] && curl -fsS --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health/ready"; } >/dev/null 2>&1 \
     || { [ "$TLS" = false ] && curl -fsS "http://127.0.0.1/api/health/ready"; } >/dev/null 2>&1; then
    echo "OK: $SCHEME://$DOMAIN работает (версия $VERSION)"
    # Ежедневная перезагрузка nginx — чтобы подхватывались продлённые сертификаты
    ( crontab -l 2>/dev/null | grep -v 'umaisense-nginx-reload' ; \
      echo "17 4 * * * cd $ROOT && docker compose exec -T nginx nginx -s reload # umaisense-nginx-reload" ) | crontab -
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done
echo "API не ответил за 150 с. Логи: docker compose logs --tail=200 api"
echo "Откат: $0 <предыдущий коммит>"
exit 1
