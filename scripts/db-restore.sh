#!/usr/bin/env bash
# 以 db:backup 的備份還原 docker compose 的資料庫，現有資料會被覆蓋。
# 同名的 -uploads.tar.gz 存在時，一併還原上傳的圖片。
#   npm run db:restore -- backups/travfree-20261108-120000.dump
#   npm run db:restore -- --yes backups/...dump   # 不詢問（CI 使用）
set -euo pipefail
cd "$(dirname "$0")/.."

yes=false
if [[ "${1:-}" == "--yes" ]]; then
  yes=true
  shift
fi
file="${1:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "用法：npm run db:restore -- [--yes] <備份檔.dump>" >&2
  echo "現有的備份：" >&2
  ls -1t backups/*.dump 2>/dev/null >&2 || echo "  （沒有，先執行 npm run db:backup）" >&2
  exit 1
fi
if [[ -z "$(docker compose ps -q db 2>/dev/null)" ]]; then
  echo "資料庫沒有在執行，先執行 docker compose up -d db" >&2
  exit 1
fi

if [[ "$yes" != true ]]; then
  read -r -p "現有的資料庫會被 $file 覆蓋，無法復原。輸入 yes 繼續：" answer
  [[ "$answer" == "yes" ]] || { echo "已取消"; exit 1; }
fi

# 還原期間停止後端，避免同時寫入；之後恢復原本的狀態
backend_was_running=false
if [[ -n "$(docker compose ps -q --status running backend 2>/dev/null)" ]]; then
  backend_was_running=true
  docker compose stop backend >/dev/null 2>&1
fi

docker compose exec -T db pg_restore -U travfree -d travfree --clean --if-exists --no-owner < "$file"
echo "已還原資料庫：$file"

uploads="${file%.dump}-uploads.tar.gz"
if [[ -f "$uploads" ]]; then
  # 後端停止時也能寫入 uploads volume
  docker compose run --rm --no-deps -T --entrypoint sh backend \
    -c 'rm -rf /app/uploads/* && tar xzf - -C /app' < "$uploads"
  echo "已還原圖片：$uploads"
fi

if [[ "$backend_was_running" == true ]]; then
  docker compose up -d --wait backend >/dev/null 2>&1
  echo "已重新啟動後端"
else
  echo "如果在開發模式，請重新啟動後端（./mvnw spring-boot:run）"
fi
