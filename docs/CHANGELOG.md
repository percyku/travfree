# 更新日誌

## [Unreleased]

### Added

- 新增 Spring Boot 後端，實作 Hexschool 電商 API 的全部 37 個端點，前端不需修改程式碼即可串接。
- 認證：Spring Security + JWT（HS256），接受裸 token 與 `Bearer` 兩種格式；登出會撤銷該帳號既有 token。
- 啟動時建立預設 admin 帳號 `admin@gmail.com`。
- Admin：產品、文章、訂單、優惠券管理，以及圖片上傳（jpg、jpeg、png，3MB 以內，檢查檔案內容）。
- Front：產品與文章瀏覽、購物車、優惠券、結帳、付款。
- PostgreSQL 資料模型：訂單保存下單當下的產品與優惠券快照。
- 統一的 JSON 錯誤格式 `{ success: false, message }`。
- `backend/docker-compose.yml` 提供 PostgreSQL 16。
- 62 個整合測試，使用 H2 PostgreSQL 模式。
- `docs/` 專案文件。
- `docs/openapi.yaml`：手寫的 OpenAPI 3.0.3 契約，涵蓋全部端點，是前後端唯一的 API 規格。
  分組名稱與順序比照 Hexschool 文件（`管理控制台 - 產品 (Products)` 等），範例取自 Hexschool 匯入的真實資料，mock server 也會回傳這些範例。
- 契約測試：所有 MockMvc 整合測試的回應都會自動對 `openapi.yaml` 驗證。
- 根目錄 `package.json`：`openapi:lint`、`openapi:preview`、`openapi:mock`（Redocly CLI、Swagger UI、Prism）。`openapi:preview` 在 `http://localhost:8081` 提供 Swagger UI。
- 專案納入 git；`backend/CLAUDE.md`、`frontend/CLAUDE.md` 分別記錄各區規則。
- 登入次數限制：同一 IP 對同一帳號 15 分鐘內失敗 5 次，或同一 IP 失敗 20 次，鎖 15 分鐘，期間回 429 並附 `Retry-After`（秒），密碼正確也擋。參數在 `app.login-limit.*`。
- `prod` profile（`application-prod.properties`）：`JWT_SECRET`、`DB_PASSWORD`、`ADMIN_PASSWORD` 未設定、使用開發預設值，或 `JWT_SECRET` 不足 32 bytes 時拒絕啟動。
- 16 個測試：`LoginRateLimitApiTest`、`LoginAttemptLimiterTest`、`ProductionConfigCheckTest`，共 78 個；之後加上文章分類必填的測試，共 79 個。

### Changed

- **API 路徑移除 `api_path`**：`/v2/api/react-week2-api/...` 改為 `/v2/api/...`，例如 `/v2/api/products`、`/v2/api/admin/products`。舊路徑回 404，不保留相容。`/v2/admin/signin`、`/v2/logout`、`/v2/api/user/check`、`/v2/uploads/*` 不變。
- 移除後端設定 `app.api-path`。
- 文章的 `tag` 改為必填，至少一個；未傳或空陣列回 400 `tag 至少選擇一個`。後台文章表單送出前也會先檢查。
- 開始前端開發，移除「不修改 `frontend/`」的規則。
- 前端移除 `VITE_APP_API_PATH`，API 網址改為 `${VITE_APP_API_BASE}/api/...`；存 token 的 cookie 改名為 `freetrav-token`，已登入的人需重新登入一次。
- 登入頁的帳號欄位預設改為空白（原本是 Hexschool 的個人帳號）。
- 新增 `frontend/.env.example`，新環境複製為 `.env.local` 即可。
- 前端清除不影響行為的 lint 問題（未使用的變數與 import、空的 `finally`），`vite.config.js`、`eslint.config.js` 改用 Node 的 globals。ESLint 問題從 44 個降為 21 個，剩下的都是 React hooks 規則。
- 前端處理 React hooks 的 lint 問題，ESLint 降為 0：補上 effect 依賴；`useMessage` 以 `useCallback` 固定回傳的函式；購物車的原價小計改為直接計算，不再存成 state；後台與產品列表的 `changePage` 移除沒有效果的 `useCallback`。`Product.jsx` 刻意不把 `tempPage`、`tempCategory` 放進依賴，原因寫在註解。
- CORS 預設允許的來源加入 `http://localhost:8081`，讓 Swagger UI 的 Try it out 可以呼叫本機後端。
- `backend/pom.xml` 新增 test scope 的 `swagger-request-validator-mockmvc`。
- `backend/pom.xml` 新增 test scope 的 H2 相依性。

### Fixed

- 前端 `Login.jsx`、`ProductedRoute.jsx` 使用未解構的 `VITE_APP_API_COOKIE_PATH`，token 失效時拋出 ReferenceError、舊 cookie 清不掉。登入寫入 cookie 時也帶上相同的 `path`。
- 前端 `AdminOrders.jsx` 使用未定義的 `navigate`，token 失效時訂單頁出錯，而不是導回登入頁。
- 前端登出改為呼叫 `POST /logout`，token 在伺服器端立即失效，不再只清 cookie。
- 前端購物車頁每次購物車變動都重建商品 modal，開啟中的 modal 可能無法關閉；改為只建立一次，離開頁面時釋放。
- 前端文章的 `content` 一律送出 `"default"`：後台新增「內文」欄位，文章頁改為顯示 `content`，`description` 只當作首頁卡片的摘要。本機既有文章的 `content` 以 `description` 補上。
- 前端 404 頁的提示原本在 render 中觸發，改到 effect 內；離開頁面時清除 3 秒後跳轉的計時器。
- 分頁查無資料時，`current_page` 改為 0（原本是 1），與 Hexschool 實際回應一致。

### 與 Hexschool 的差異

- `GET ~/orders` 改為需要 admin token，避免公開全部訂單個資。
- Admin 文章清單包含 `content`，避免前端編輯時覆寫內文。
- `POST /admin/signin` 失敗次數過多時回 429，Hexschool 沒有次數限制。
- 路徑不含 Hexschool 的 `api_path`。
- 其他差異見 [ARCHITECTURE.md](ARCHITECTURE.md)。
