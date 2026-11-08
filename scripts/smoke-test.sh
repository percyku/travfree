#!/usr/bin/env bash
# 對 docker compose 啟動的服務做基本檢查，本機與 CI 共用。
#   BASE_URL       網站網址，預設 http://localhost:8000
#   ADMIN_EMAIL    預設 admin@gmail.com
#   ADMIN_PASSWORD 預設 Test123456（開發用）
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@gmail.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Test123456}"
failed=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == *"$expected"* ]]; then
    echo "通過  $name"
  else
    echo "失敗  $name"
    echo "      預期包含：$expected"
    echo "      實際：${actual:0:300}"
    failed=1
  fi
}

# 狀態碼與 body 一起取得，最後一行是狀態碼
request() {
  curl -sS -w '\n%{http_code}' "$@"
}

res=$(request "$BASE_URL/")
check "首頁回傳 React 頁面" '<div id="root">' "$res"
check "首頁 200" $'\n200' "$res"

js=$(echo "$res" | grep -o '/assets/[^"]*\.js' | head -1)
check "首頁引用的 JS 存在" $'\n200' "$(request -o /dev/null "$BASE_URL$js")"

res=$(request "$BASE_URL/v2/api/products")
check "經 nginx 轉發 API" '"success":true' "$res"

res=$(request -X POST "$BASE_URL/v2/admin/signin" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
check "admin 登入" '"success":true' "$res"
token=$(echo "$res" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

res=$(request -X POST "$BASE_URL/v2/api/user/check" -H "Authorization: $token")
check "token 驗證" '"success":true' "$res"

res=$(request "$BASE_URL/v2/api/admin/orders" -H "Authorization: $token")
check "後台 API 需要 token 時可用" '"success":true' "$res"

# 瀏覽器的 POST 即使同源也會帶 Origin；不能被當成跨來源請求擋下（403 Invalid CORS request）
res=$(request -X POST "$BASE_URL/v2/api/cart" \
  -H "Origin: $BASE_URL" -H 'Content-Type: application/json' \
  -d '{"data":{"product_id":"smoke-test-not-exist","qty":1}}')
check "同源的寫入請求不被 CORS 擋下" '找不到產品' "$res"

res=$(request -X POST "$BASE_URL/v2/admin/signin" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"smoke-test@example.com\",\"password\":\"wrong-password\"}")
check "錯誤回應是後端的 JSON" '"success":false' "$res"

if [[ $failed -ne 0 ]]; then
  echo "smoke test 失敗"
  exit 1
fi
echo "smoke test 全部通過"
