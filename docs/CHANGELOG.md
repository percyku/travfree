# 更新日誌

## [Unreleased]

### Added

- 種子資料：`npm run seed` 透過 API 匯入 `scripts/seed/data.json` 的 30 筆產品、5 篇文章與 1 張優惠券，已存在的資料會略過；`npm run seed:export` 從後台重新匯出。
- 資料庫備份與還原：`npm run db:backup` 存到 `backups/`（不進 git，含上傳的圖片），`npm run db:restore -- <檔案>` 確認後還原。CI 的 Docker compose job 會實際執行匯入、備份、清空與還原。
- Docker：`backend/Dockerfile`、`frontend/Dockerfile`（nginx 提供前端並轉發 `/v2`）與根目錄的 `docker-compose.yml`，`docker compose up -d --build` 一次啟動前端、後端與資料庫（`http://localhost:8000`）。沒有 `.env` 時使用開發設定，部署時依 `.env.example` 設定 prod profile 與密鑰。資料庫沿用原本的 volume `backend_postgres-data`。
- CI 新增 Docker compose job：以 prod profile 與隨機密鑰啟動全新環境，執行 `scripts/smoke-test.sh`。
- CI（`.github/workflows/ci.yml`）：push 到 `main` 或開 PR 時，以 GitHub Actions 執行 OpenAPI lint、後端測試，以及前端 lint、測試與建置。
- 前端自動化測試（`cd frontend && npm test`）：Vitest + React Testing Library + MSW，涵蓋登入、後台路由保護、購物車、優惠券、結帳與付款，以及後台產品、文章、訂單、優惠券管理與登出，共 90 個。MSW 的每個請求與回應都會對 `docs/openapi.yaml` 檢查，前端送錯格式或測試假資料與 spec 不符時測試失敗。說明見 `docs/TESTING.md`。
- `DELETE /api/coupon`：移除購物車已套用的優惠券；前端在已套用的優惠碼旁加上「移除」。
- 前端優惠券與付款 UI：後台「優惠券列表」（`/admin/coupons`）可新增、編輯、刪除，折扣以實付比例輸入並顯示折數，到期日有效到當天 23:59:59；購物車頁可輸入優惠碼，費用明細分開列出商品特價折抵與優惠券折抵；訂單成功頁顯示付款狀態並可付款。
- 後台訂單列表新增「優惠券」欄；訂單 modal 列出各品項小計、折扣後金額與優惠券，以及商品小計、優惠券折抵（含優惠碼、名稱、折數）與實付金額。資料來自下單當下的快照。
- 後台產品與優惠券的刪除確認視窗說明刪除的影響，並建議只是暫停使用時改為停用。
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
- 16 個測試：`LoginRateLimitApiTest`、`LoginAttemptLimiterTest`、`ProductionConfigCheckTest`，共 78 個；之後加上文章分類必填的測試，共 79 個；再加上優惠券有效性、移除優惠券、結帳金額比對的測試，共 84 個。

### Changed

- GitHub repo 由 `percyku/freetrav` 改名為 `percyku/travfree`，舊網址會自動導向。根目錄 `README.md` 的「啟動與停止」整理 Docker 與開發模式的啟動、停止指令。
- 移除 `backend/docker-compose.yml`，資料庫改由根目錄的 `docker-compose.yml` 提供，開發時執行 `docker compose up -d db`。
- 前端 `vite.config.js` 的 `base` 改為 `/`（原本 production 是舊專案 gh-pages 的 `/react-training-2025-final/`），並移除 `gh-pages` 與 `deploy` script。
- **API 路徑移除 `api_path`**：`/v2/api/react-week2-api/...` 改為 `/v2/api/...`，例如 `/v2/api/products`、`/v2/api/admin/products`。舊路徑回 404，不保留相容。`/v2/admin/signin`、`/v2/logout`、`/v2/api/user/check`、`/v2/uploads/*` 不變。
- 移除後端設定 `app.api-path`。
- 已套用的優惠券改為只在**啟用且未過期**時有效，停用或過期立即不再折扣（原本只在套用時檢查到期日）。
- `POST /api/order` 新增選填的 `final_total`，與購物車金額不同時回 409 `訂單金額已變動，請重新確認`。前端送出訂單時帶上畫面顯示的總計，進入填寫資料頁時重新讀取購物車。
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

- 前端後台文章 modal 的「輸入圖片網址」使用 `defaultValue`，編輯文章時顯示的是預設圖片網址，而不是該文章的圖片；改為 `value`。
- 前端後台文章 modal 的「輸入圖片網址」、「作者」label 沒有對應到正確的欄位（點 label 不會聚焦，螢幕閱讀器也讀不到）。
- 前端後台產品圖片上傳失敗時顯示 `Upload error: AxiosError: ...`，改為顯示後端原因，例如 `上傳失敗! 檔案大小不得超過 3MB`；成功提示改為「上傳成功」。
- 前端登入失敗時顯示 `登入失敗 AxiosError: ...`，改為顯示後端回傳的原因，例如登入次數過多時的 `登入失敗次數過多，請 15 分鐘後再試`。
- 前端 `App.jsx` 以 `./components/messageToast` 匯入 `MessageToast.jsx`，大小寫不一致，在區分大小寫的檔案系統（Linux）上找不到檔案。
- 前端 `Login.jsx`、`ProductedRoute.jsx` 使用未解構的 `VITE_APP_API_COOKIE_PATH`，token 失效時拋出 ReferenceError、舊 cookie 清不掉。登入寫入 cookie 時也帶上相同的 `path`。
- 前端 `AdminOrders.jsx` 使用未定義的 `navigate`，token 失效時訂單頁出錯，而不是導回登入頁。
- 前端登出改為呼叫 `POST /logout`，token 在伺服器端立即失效，不再只清 cookie。
- 前端購物車頁每次購物車變動都重建商品 modal，開啟中的 modal 可能無法關閉；改為只建立一次，離開頁面時釋放。
- 前端文章的 `content` 一律送出 `"default"`：後台新增「內文」欄位，文章頁改為顯示 `content`，`description` 只當作首頁卡片的摘要。本機既有文章的 `content` 以 `description` 補上。
- 前端開啟 modal 後立刻送出時，modal 不會自動關閉（Bootstrap 在開啟動畫期間忽略 `hide()`）。新增 `utils/modal.js` 的 `createModal`，等動畫結束後再關閉，後台三個頁面與購物車頁改用它。
- 前端後台新增、更新、刪除失敗時只顯示「更新失敗!」等固定文字，改為附上後端回傳的原因；沒有回應（網路錯誤）時不再於 catch 中拋錯。
- 前端文章 modal 的標題誤寫為「產品」。
- 前端 404 頁的提示原本在 render 中觸發，改到 effect 內；離開頁面時清除 3 秒後跳轉的計時器。
- 分頁查無資料時，`current_page` 改為 0（原本是 1），與 Hexschool 實際回應一致。

### 與 Hexschool 的差異

- `GET ~/orders` 改為需要 admin token，避免公開全部訂單個資。
- Admin 文章清單包含 `content`，避免前端編輯時覆寫內文。
- `POST /admin/signin` 失敗次數過多時回 429，Hexschool 沒有次數限制。
- 路徑不含 Hexschool 的 `api_path`。
- 其他差異見 [ARCHITECTURE.md](ARCHITECTURE.md)。
