#!/usr/bin/env bash
# Проверка, что данные UmaiSense обрабатываются только в Yandex Cloud KZ.
#   ./verify-locality.sh --env-only   — только проверка /opt/umaisense/.env (вызывается из deploy.sh)
#   ./verify-locality.sh              — полная проверка на сервере: .env, DNS, исходящие соединения, код
#   CAPTURE_SECONDS=600 ./verify-locality.sh   — дольше наблюдать исходящие соединения
set -uo pipefail

ROOT=/opt/umaisense
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
SRC="${SRC:-$ROOT/src}"
FAIL=0
ok()   { echo "  [OK]   $*"; }
warn() { echo "  [WARN] $*"; }
bad()  { echo "  [FAIL] $*"; FAIL=1; }

host_of() { echo "$1" | sed -E 's#^[a-z+]+://##; s#^[^@/]*@##; s#[/?].*$##' | tr ',' '\n' | sed -E 's#:[0-9]+$##'; }
is_local() {
  case "$1" in
    *.yandexcloud.kz|yandexcloud.kz|localhost|127.*|10.*|192.168.*|mongo|api|nginx) return 0 ;;
    172.1[6-9].*|172.2[0-9].*|172.3[01].*) return 0 ;;
  esac
  for h in $(echo "${LOCALITY_ALLOWED_HOSTS:-}" | tr ',' ' '); do [ "$1" = "$h" ] && return 0; done
  return 1
}

echo "== 1. Переменные окружения ($ENV_FILE)"
if [ -f "$ENV_FILE" ]; then
  . "$(dirname "$(readlink -f "$0")")/lib.sh"; load_env "$ENV_FILE"
  for v in MONGO_URI S3_ENDPOINT SMTP_HOST AI_YANDEX_BASE_URL AI_LOCAL_BASE_URL; do
    val="${!v:-}"; [ -z "$val" ] && continue
    for h in $(host_of "$val"); do
      if is_local "$h"; then ok "$v → $h"; else bad "$v → $h (не Yandex Cloud KZ и не в LOCALITY_ALLOWED_HOSTS)"; fi
    done
  done
  grep -qE '^CLOUDINARY_' "$ENV_FILE" && bad "в .env есть CLOUDINARY_* — удалите"
  grep -qE 'mongodb\.net' "$ENV_FILE" && bad "в .env есть адрес MongoDB Atlas"
  AI="${AI_SCREENING_PROVIDER:-off}"
  if [ "$AI" = "openai" ]; then
    if [ "${ALLOW_FOREIGN_AI:-}" = "true" ]; then
      warn "ИИ = OpenAI (США): обезличенные данные уходят за рубеж ТОЛЬКО с согласием родителя cross_border (ALLOW_FOREIGN_AI=true)"
    else
      bad "AI_SCREENING_PROVIDER=openai без ALLOW_FOREIGN_AI=true — сервер не запустится"
    fi
  else
    ok "ИИ = $AI"
  fi
else
  bad "нет файла $ENV_FILE"
fi
[ "${1:-}" = "--env-only" ] && exit $FAIL

echo "== 2. DNS домена"
if [ -n "${DOMAIN:-}" ]; then
  IP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
  MY=$(curl -fsS -m 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
  if [ -n "$IP" ] && [ "$IP" = "$MY" ]; then ok "$DOMAIN → $IP (этот сервер)"; else warn "$DOMAIN → ${IP:-нет} , IP сервера ${MY:-?}"; fi
fi

echo "== 3. Исходящие соединения за ${CAPTURE_SECONDS:-120} с (кроме внутренней сети)"
END=$((SECONDS + ${CAPTURE_SECONDS:-120})); declare -A SEEN
while [ $SECONDS -lt $END ]; do
  while read -r dst; do SEEN["$dst"]=1; done < <(sudo conntrack -L -p tcp 2>/dev/null | grep -oE 'dst=[0-9.]+ sport=[0-9]+ dport=[0-9]+' | awk '{print $1":"$3}' | sed 's/dst=//; s/dport=//' | sort -u)
  sleep 5
done
for d in "${!SEEN[@]}"; do
  ip=${d%%:*}; port=${d##*:}
  case "$ip" in 10.*|127.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|192.168.*) continue ;; esac
  name=$(getent hosts "$ip" | awk '{print $2}')
  echo "  → $ip:$port ${name:-(нет PTR)}"
done
echo "  Сверьте адреса: ожидаются Yandex Cloud KZ (storage/mdb/api.yandexcloud.kz), SMTP-провайдер РК,"
echo "  репозитории пакетов (только при обновлении) и api.openai.com — если ИИ = OpenAI по флагу."

echo "== 4. Код: ссылки на зарубежные сервисы"
if [ -d "$SRC" ]; then
  HITS=$(grep -rnEi 'vercel\.app|netlify|mongodb\.net|res\.cloudinary|smtp\.gmail|fonts\.googleapis|fonts\.gstatic|googletagmanager|google-analytics' \
    "$SRC/umaisense-back-main/src" "$SRC/umiasense-front-main/src" "$SRC/umiasense-front-main/index.html" 2>/dev/null \
    | grep -v 'scripts/\|isForeign\|mongodb\\\.net\|res\\\.cloudinary\|env\.ts' || true)
  if [ -n "$HITS" ]; then warn "найдены упоминания (проверьте, не используются ли в рабочем коде):"; echo "$HITS" | head -20
  else ok "рабочий код не обращается к Vercel/Netlify/Atlas/Cloudinary/Gmail/Google Fonts"; fi
fi

echo
[ $FAIL -eq 0 ] && echo "Итог: нарушений не найдено." || echo "Итог: есть нарушения (FAIL) — исправьте до переключения DNS."
exit $FAIL
