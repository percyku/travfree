#!/usr/bin/env bash
# 啟動獨立的 docker compose 環境（全新資料庫）→ 匯入種子 → 執行 Playwright → 刪除整套環境。
# 平常使用的 :8000 環境與資料不受影響。
#   npm run e2e                      # 全部
#   npm run e2e -- --headed          # 開啟瀏覽器視窗觀看
#   npm run e2e -- tests/shopping.spec.js
#   E2E_KEEP=1 npm run e2e           # 結束後保留環境（http://localhost:8100），方便除錯
set -euo pipefail
cd "$(dirname "$0")/.."
root=$(pwd)

export COMPOSE_PROJECT_NAME=travfree-e2e
export APP_PORT="${E2E_PORT:-8100}"
export DB_PORT="${E2E_DB_PORT:-5433}"
export DB_VOLUME=travfree-e2e-db
export PUBLIC_BASE_URL="http://localhost:${APP_PORT}/v2"
# Google 登入：以臨時產生的測試金鑰取代 Google，見 scripts/google-test-key.sh 與 e2e/tests/google.spec.js
export GOOGLE_CLIENT_ID=e2e-client.apps.googleusercontent.com
GOOGLE_TEST_PUBLIC_KEY=$(scripts/google-test-key.sh)
export GOOGLE_TEST_PUBLIC_KEY
# 不讀根目錄的 .env（部署設定），固定使用開發設定
compose() { docker compose --env-file /dev/null "$@"; }

cleanup() {
  if [[ "${E2E_KEEP:-}" == "1" ]]; then
    echo "保留 E2E 環境：http://localhost:${APP_PORT}（刪除：COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME} docker compose down -v）"
  else
    compose down -v >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ ! -d e2e/node_modules ]]; then
  (cd e2e && npm ci)
fi
(cd e2e && npx playwright install chromium >/dev/null)

echo "啟動 E2E 環境（http://localhost:${APP_PORT}）…"
compose up -d --build --wait >/dev/null 2>&1 || { compose logs --no-color | tail -50; exit 1; }
API_BASE="${PUBLIC_BASE_URL}" node scripts/seed.mjs

cd e2e
BASE_URL="http://localhost:${APP_PORT}" npx playwright test "$@" || {
  echo "E2E 失敗，查看報告：cd e2e && npm run report"
  exit 1
}
