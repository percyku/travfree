#!/usr/bin/env bash
# 備份 docker compose 的資料庫（含訂單與帳號）到 backups/。後端容器在執行時，一併備份上傳的圖片。
# 備份檔含個資與密碼雜湊，backups/ 不進 git。
#   npm run db:backup
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "$(docker compose ps -q db 2>/dev/null)" ]]; then
  echo "資料庫沒有在執行，先執行 docker compose up -d db" >&2
  exit 1
fi

mkdir -p backups
name="backups/travfree-$(date +%Y%m%d-%H%M%S)"

docker compose exec -T db pg_dump -U travfree -d travfree --format=custom > "$name.dump"
echo "資料庫：$name.dump"

if [[ -n "$(docker compose ps -q --status running backend 2>/dev/null)" ]]; then
  docker compose exec -T backend tar czf - -C /app uploads > "$name-uploads.tar.gz"
  echo "圖片：  $name-uploads.tar.gz"
else
  echo "後端容器沒有在執行，略過圖片備份（開發模式的圖片在 backend/uploads/）"
fi
