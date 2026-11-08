# 部署前加強：登入次數限制與正式環境密鑰檢查

## 目標

處理 `ARCHITECTURE.md` 已知限制中的兩項：

- 登入沒有次數限制。
- 開發用預設密鑰與密碼寫在 `application.properties`，部署時忘了覆寫也能啟動。

## 決定（2026-11-08 與使用者確認）

### 登入次數限制

- 兩種計數同時生效，任一種達到上限就擋：
  - **IP + 帳號**：15 分鐘內失敗 5 次，鎖 15 分鐘。登入成功會歸零。
  - **IP 總量**：同一 IP 不分帳號，15 分鐘內失敗 20 次，鎖 15 分鐘。登入成功不歸零。
- 不只看帳號，避免任何人故意輸錯就把 admin 鎖在外面。
- 被鎖時回 **429** `{ success: false, message: "登入失敗次數過多，請 N 分鐘後再試" }`，附 `Retry-After`（秒）。**密碼正確也擋**，否則暴力破解仍可繼續。
- 鎖定期間的請求不計入失敗次數，不會延長鎖定時間。
- 欄位驗證失敗（400 `username 屬性不得為空`）不計入。
- 帳號比對不分大小寫、去除前後空白。
- 計數存在記憶體，重啟後歸零，只適用單一實例部署（與圖片存本機磁碟的限制相同）。
- IP 取 `request.getRemoteAddr()`。放在反向代理後面時，要設定 `SERVER_FORWARD_HEADERS_STRATEGY=native` 等方式，預設不信任 `X-Forwarded-For`，避免被偽造。
- 參數放在 `app.login-limit.*`，可用設定檔調整。

### 正式環境密鑰檢查

- 新增 `application-prod.properties`，以 `SPRING_PROFILES_ACTIVE=prod` 啟用。
- prod profile 下，`JWT_SECRET`、`DB_PASSWORD`、`ADMIN_PASSWORD` 未設定、空白，或等於開發用預設值時，**拒絕啟動**，錯誤訊息列出所有有問題的變數。
- `JWT_SECRET` 另外檢查至少 32 bytes。
- 本機開發（沒有 prod profile）維持現狀。
- 以 `EnvironmentPostProcessor` 實作，在連線資料庫之前就檢查，錯誤訊息才清楚。

## 步驟

1. `openapi.yaml`：`POST /admin/signin` 加上 429 與 `Retry-After` header，通過 `openapi:lint`。
2. `AppProperties` 加上 `loginLimit`；`application.properties` 加預設值。
3. `LoginAttemptLimiter`（`security`）；`AuthService.signin` 接收 IP；`TooManyRequestsException` 與對應的 handler。
4. `ProductionConfigCheck`（`config`），在 `META-INF/spring.factories` 註冊；新增 `application-prod.properties`。
5. 測試：
   - `LoginRateLimitApiTest`（整合、契約驗證）：帳號鎖定、密碼正確也擋、換 IP 不受影響、IP 總量、成功歸零、`Retry-After`。
   - `LoginAttemptLimiterTest`（單元）：鎖定到期後恢復、計數視窗過期後重算。
   - `ProductionConfigCheckTest`（單元）：缺少、預設值、太短、全部正確。
   - `ApiTestSupport` 每次測試前清空計數。
6. 文件：`FEATURES.md`、`ARCHITECTURE.md`（已知限制、套件表）、`README.md`（環境變數、部署）、`TESTING.md`、`CHANGELOG.md`。
7. 在真實 PostgreSQL 上啟動驗證：本機正常、prod 缺少變數時拒絕啟動。
