# Общие функции скриптов. Подключается: . "$(dirname "$0")/lib.sh"

# Безопасное чтение .env: значения НЕ выполняются как команды оболочки
# (в строке MONGO_URI есть «&», в паролях могут быть $, ` и пробелы).
load_env() {
  local line k v
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    k=${BASH_REMATCH[1]}; v=${BASH_REMATCH[2]}
    if [[ "$v" =~ ^\"(.*)\"$ ]] || [[ "$v" =~ ^\'(.*)\'$ ]]; then v=${BASH_REMATCH[1]}; fi
    export "$k=$v"
  done < "$1"
}
