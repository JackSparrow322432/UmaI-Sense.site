#!/usr/bin/env bash
# Обновление без простоя: серверы обновляются по одному, следующий — только когда предыдущий здоров.
#   ./deploy/deploy-app.sh            (запускать с машины, у которой есть ssh-доступ к app1/app2)
set -euo pipefail
HOSTS=("10.10.0.21" "10.10.0.22")
for h in "${HOSTS[@]}"; do
  echo "→ $h: обновление"
  ssh "deploy@$h" 'cd /opt/umaisense && git pull --ff-only && docker compose -f deploy/app/docker-compose.yml up -d --build'
  echo "→ $h: ждём готовности"
  for i in $(seq 1 30); do
    if ssh "deploy@$h" 'curl -fsS http://127.0.0.1:5000/api/health/ready' >/dev/null 2>&1; then
      echo "  ✓ $h готов"; break
    fi
    sleep 3
    if [ "$i" = 30 ]; then echo "  ✗ $h не поднялся — остановка деплоя"; exit 1; fi
  done
done
echo "Готово"
