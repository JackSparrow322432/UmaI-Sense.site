#!/usr/bin/env bash
# Первичная настройка кластера Garage. Запускать на data1 после старта Garage на всех 3 узлах.
# Требуется aws CLI (для CORS) — можно запускать с любой машины с доступом к s3.umaisense.kz.
set -euo pipefail
G="docker compose -f /opt/umaisense/deploy/data/docker-compose.yml exec -T garage /garage"

echo "1. ID узлов (подставьте в layout):"
$G status

cat <<'TXT'
2. Соедините узлы и задайте раскладку (выполнить вручную, подставив ID):
   $G node connect <ID_data2>@10.10.0.12:3901
   $G node connect <ID_data3>@10.10.0.13:3901
   $G layout assign -z dc1 -c 500G <ID_data1>
   $G layout assign -z dc2 -c 500G <ID_data2>
   $G layout assign -z dc3 -c 500G <ID_data3>
   $G layout apply --version 1
   (-z — «зона»: если узлы в разных ЦОД Freedom Cloud, укажите разные зоны)

3. Ключ и бакеты:
   $G key create umaisense-app                    # сохраните Key ID и Secret → S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
   $G bucket create umaisense-documents           # ЗАКРЫТЫЙ — медицинские документы
   $G bucket create umaisense-public              # картинки интерфейса
   $G bucket allow --read --write --owner umaisense-documents --key umaisense-app
   $G bucket allow --read --write --owner umaisense-public --key umaisense-app
   $G bucket website --allow umaisense-public     # раздача публичного бакета через /media

4. CORS — браузер загружает документы напрямую в хранилище:
   aws --endpoint-url https://s3.umaisense.kz --region garage s3api put-bucket-cors \
     --bucket umaisense-documents --cors-configuration file://cors.json
   где cors.json:
   {"CORSRules":[{"AllowedOrigins":["https://app.umaisense.kz"],
                  "AllowedMethods":["PUT","GET"],
                  "AllowedHeaders":["Content-Type"],
                  "MaxAgeSeconds":3600}]}
TXT
