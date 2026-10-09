#!/usr/bin/env bash
# Однократная подготовка: профиль yc для региона Казахстан, сервисный аккаунт для Terraform
# и бакет для состояния Terraform (state хранится в KZ, не локально и не в Terraform Cloud).
#
# Запуск (на своём компьютере/в WSL, где установлен yc CLI):
#   CLOUD_ID=... FOLDER_ID=... ./bootstrap-state.sh
# Ничего платного, кроме крошечного бакета для state, не создаётся.
set -euo pipefail

: "${CLOUD_ID:?укажите CLOUD_ID}"
: "${FOLDER_ID:?укажите FOLDER_ID}"
PROFILE="${PROFILE:-umaisense-kz}"
SA_NAME="${SA_NAME:-umaisense-terraform}"
STATE_BUCKET="${STATE_BUCKET:-umaisense-tfstate-$(echo "$FOLDER_ID" | tr 'A-Z' 'a-z' | tail -c 9)}"
OUT_DIR="${OUT_DIR:-$HOME/.umaisense-kz}"

mkdir -p "$OUT_DIR" && chmod 700 "$OUT_DIR"

if ! yc config profile get "$PROFILE" >/dev/null 2>&1; then
  yc config profile create "$PROFILE"
fi
yc config profile activate "$PROFILE"
yc config set endpoint api.yandexcloud.kz:443
yc config set cloud-id "$CLOUD_ID"
yc config set folder-id "$FOLDER_ID"
echo "Если ещё не вошли: yc init --endpoint api.yandexcloud.kz:443 (или yc config set token ...)"

if ! yc iam service-account get "$SA_NAME" >/dev/null 2>&1; then
  yc iam service-account create --name "$SA_NAME" --description "Terraform для UmaiSense (kz1)"
fi
SA_ID=$(yc iam service-account get "$SA_NAME" --format json | jq -r .id)

# Права только на каталог проекта
for role in admin; do
  yc resource-manager folder add-access-binding "$FOLDER_ID" --role "$role" --subject "serviceAccount:$SA_ID" >/dev/null || true
done

if [ ! -f "$OUT_DIR/sa-key.json" ]; then
  yc iam key create --service-account-id "$SA_ID" --output "$OUT_DIR/sa-key.json"
  chmod 600 "$OUT_DIR/sa-key.json"
fi

if [ ! -f "$OUT_DIR/storage-keys.json" ]; then
  yc iam access-key create --service-account-id "$SA_ID" --format json > "$OUT_DIR/storage-keys.json"
  chmod 600 "$OUT_DIR/storage-keys.json"
fi
ACCESS_KEY=$(jq -r .access_key.key_id "$OUT_DIR/storage-keys.json")
SECRET_KEY=$(jq -r .secret "$OUT_DIR/storage-keys.json")

if ! yc storage bucket get "$STATE_BUCKET" >/dev/null 2>&1; then
  yc storage bucket create --name "$STATE_BUCKET" --default-storage-class standard --max-size 1073741824
  yc storage bucket update --name "$STATE_BUCKET" --versioning versioning-enabled
fi

cat > "$OUT_DIR/backend.hcl" <<HCL
bucket     = "$STATE_BUCKET"
access_key = "$ACCESS_KEY"
secret_key = "$SECRET_KEY"
HCL
chmod 600 "$OUT_DIR/backend.hcl"

cat <<MSG

Готово. Файлы с ключами (НЕ коммитить, НЕ загружать в GitHub): $OUT_DIR
  sa-key.json        — ключ сервисного аккаунта для провайдера (sa_key_file)
  storage-keys.json  — статический ключ для бакетов (storage_admin_access_key / secret_key)
  backend.hcl        — параметры бэкенда state

Дальше:
  cd infra/yandex-kz
  cp terraform.tfvars.example terraform.tfvars   # заполните cloud_id, folder_id, ssh_public_key, admin_ip_cidrs, mongo_password
  tofu init -backend-config=$OUT_DIR/backend.hcl   # или terraform init
  tofu plan
MSG
