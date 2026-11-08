# 測試規範

## 執行方式

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test

cd frontend
npm test              # 執行一次；npm run test:watch 會持續監看
```

後端不需要 Docker。測試使用 `test` profile 與 H2 記憶體資料庫的 PostgreSQL 模式，設定在 `src/test/resources/application-test.properties`。

## CI

`.github/workflows/ci.yml`：push 到 `main` 或開 PR 時，GitHub Actions 在 Linux 上同時跑四個 job，結果在 repo 的 **Actions** 分頁：

| Job | 內容 |
|---|---|
| OpenAPI spec | `npm run openapi:lint` |
| 後端測試 | `./mvnw -B test`（Java 21、H2，不需要資料庫服務）。失敗時可下載 `backend-surefire-reports` 查看細節 |
| 前端 lint、測試與建置 | `npm run lint`、`npm test`、`npm run build` |
| Docker compose | 以 prod profile 與隨機產生的密鑰，`docker compose up -d --build --wait` 啟動全新的資料庫與前後端，再跑 `scripts/smoke-test.sh`；接著匯入種子資料兩次（第二次應全部略過），再備份 → `down -v` → 還原，確認種子資料都還在。失敗時輸出各服務的 log |

- CI 跑在區分大小寫的 Linux 上，可以抓到 macOS 上發現不了的匯入路徑大小寫錯誤。
- 同一個分支有新的 push 時，會取消還在跑的舊檢查。
- 依賴以 `npm ci` 依照 lock 檔安裝，新增套件時要一併 commit `package-lock.json`。

`scripts/smoke-test.sh` 透過 nginx 檢查：首頁與 JS 載入、API 轉發、admin 登入與 token、後台 API、同源的寫入請求不被 CORS 擋下、錯誤回應是後端的 JSON。本機在 `docker compose up` 之後也可以執行。

## 契約驗證

`OpenApiContractConfig` 讓**所有** MockMvc 回應都自動對 `docs/openapi.yaml` 驗證（`swagger-request-validator-mockmvc`）。繼承 `ApiTestSupport` 的測試都會套用，不需要另外撰寫。

- 只驗證回應，不驗證請求，因為測試會刻意送出錯誤的請求來測錯誤情境。
- 失敗時會丟出 `OpenApiValidationException`，訊息會指出欄位與 schema 位置。先判斷是實作錯還是 spec 錯，不可以只為了讓測試通過而放寬 spec。
- spec 位置寫死為 `../docs/openapi.yaml`，所以要在 `backend/` 執行 `./mvnw test`。
- `HttpContractTest` 走真實 Tomcat、不經過 MockMvc，不在驗證範圍內。

要對正在執行的後端驗證，可以用 Prism 的 proxy 模式，回應不符合 spec 時，Prism 會在 header 加上 `sl-violations`：

```bash
npx prism proxy docs/openapi.yaml http://localhost:8080/v2 --port 4011 --errors
```

Prism 轉送 multipart 時會損壞檔案內容，圖片上傳要直接打後端。

## 測試策略

完整的單元測試與前後端整合測試，延後到主要功能完成後再做。在那之前，後端每個新 API 至少要有：

- 通過契約驗證的成功情境。
- 主要錯誤情境的狀態碼與訊息。

## 測試結構

整合測試為主，用 `@SpringBootTest` 啟動完整應用，走真實的 Security、JWT 與資料庫流程，不 mock service。這個專案的主要風險是 API 契約與前端不一致，單元測試抓不到這類問題。

| 測試 | 涵蓋範圍 |
|---|---|
| `AuthApiTest` | 登入、token 格式、登出撤銷、無效 token 不影響公開 API、Admin 路由權限 |
| `LoginRateLimitApiTest` | 登入次數限制：帳號鎖定、密碼正確也擋、換 IP 不受影響、IP 總量、成功歸零、429 與 `Retry-After` |
| `ProductApiTest` | 產品 CRUD、上下架連動、分頁、排序、分類、驗證訊息 |
| `ArticleApiTest` | 文章 CRUD、公開與否的連動、`content` 可見範圍、`create_at` 原值保存 |
| `CartApiTest` | 購物車、數量累加、即時計價、優惠券計算、優惠券管理 |
| `OrderApiTest` | 結帳、訂單快照、付款、Admin 更新、時間單位 |
| `UploadApiTest` | 圖片上傳與讀取、內容檢查、大小限制 |
| `HttpContractTest` | 走真實 Tomcat：`/v2` 前綴、CORS、超過上傳上限的回應 |
| `BackendApplicationTests` | 應用程式可以啟動 |
| `security.LoginAttemptLimiterTest` | 單元測試：鎖定到期、計數視窗過期、鎖定不延長、秒數進位。整合測試無法快轉時鐘 |
| `config.ProductionConfigCheckTest` | prod profile 缺少密鑰、使用預設值、密鑰太短時拒絕啟動，含真實啟動一次確認註冊與設定檔生效 |
| `OpenApiContractConfig` | 不是測試，讓所有 MockMvc 回應都對 spec 驗證 |

`ApiTestSupport` 是共用基底：每個測試前清空業務資料與登入次數計數並重新登入，也提供建立產品、加入購物車、結帳等輔助方法。MockMvc 請求都來自 `127.0.0.1`，要測不同 IP 時用 `.with(request -> { request.setRemoteAddr(...); return request; })`。

## 撰寫原則

- **以前端的實際行為為準。** 請求內容比照前端送出的格式，包含多餘欄位、字串型別的 `status`、裸 token。斷言前端實際讀取的欄位。
- **新增 API 至少涵蓋**：成功回應的欄位名稱與型別、權限、每個錯誤情境的狀態碼與訊息。
- **時間與金額要斷言單位與精確值。** 秒與毫秒搞混是這個專案最容易發生的錯誤。
- **業務規則要測連動**，例如下架後 Front 看不到、改價後訂單不變，而不只測單一端點。
- 需要真實 HTTP 行為時（CORS、multipart 上限、context-path）放進 `HttpContractTest`。MockMvc 不經過 context-path，也不會執行 Tomcat 的 multipart 上限。

## 前端測試

Vitest + jsdom + React Testing Library，以 MSW 攔截 axios 請求，不需要啟動後端或 mock server。設定在 `frontend/vitest.config.js`，共用工具在 `frontend/src/test/`。

Prism mock server 不保存狀態、回傳隨機假資料，無法測「套用優惠券後重新讀取購物車」這類流程，所以改用 MSW，由各測試自己模擬後端狀態。

### 契約檢查

用 `src/test/contract.js` 的 `api.get/post/put/delete` 定義 MSW handler，每個請求與回應都會對 `docs/openapi.yaml` 檢查，違規時該測試失敗：

- 路徑與方法必須在 spec 裡，否則定義 handler 時就丟錯。
- 前端送出的 body 必須符合 `requestBody` schema。和後端相反，前端**要**驗證請求，因為要確認的就是前端送出的格式。
- 需要 `AdminToken` 的端點必須帶 `Authorization` header。
- multipart 請求（圖片上傳）必須帶 spec 要求的欄位，例如 `file-to-upload`。
- 測試假資料必須符合該狀態碼的回應 schema，spec 沒列出的狀態碼要符合 `default`。假資料和 spec 不一致時，先判斷是假資料錯還是 spec 錯。
- 測試中出現沒有定義 handler 的請求也算違規，可以用來確認「不應該呼叫 API」的情境。

`src/test/contract.test.js` 確認上述檢查本身有效。

### 測試結構

| 測試 | 涵蓋範圍 |
|---|---|
| `utils/coupon.test.js` | 到期日秒數換算、折數文字、是否過期、優惠券摘要、千分位 |
| `pages/front/CartCheckout.test.jsx` | 費用明細金額、套用/移除優惠券、無效優惠碼、之後加入的品項提示、調整數量、刪除與清空、空購物車 |
| `pages/front/CartForm.test.jsx` | 進入頁面重新讀取購物車、欄位驗證、送出時帶 `final_total`、409 金額變動、空購物車不能送出 |
| `pages/front/CartSuccess.test.jsx` | 訂單品項與總計、付款後顯示付款時間、付款失敗、找不到訂單 |
| `pages/Login.test.jsx` | 登入成功寫入 cookie、400/429 顯示後端原因、欄位驗證、已登入直接進後台、token 失效；後台路由保護 |
| `pages/admin/AdminProducts.test.jsx` | 列表、新增（價格轉整數、空白副圖不送出）、編輯、刪除提示、圖片上傳成功與失敗、分頁、取得失敗導向登入頁 |
| `pages/admin/AdminArticle.test.jsx` | 列表（`create_at` 毫秒）、新增（分類、內文換行、`create_at`）、未選分類、編輯保留 `create_at`、連續編輯兩篇的圖片網址、刪除、分頁 |
| `pages/admin/AdminOrders.test.jsx` | 列表（付款時間秒）、明細的品項與優惠券快照、沒有優惠券的訂單、修改付款與外送狀態（`status` 字串）、更新失敗、分頁 |
| `pages/admin/AdminCoupons.test.jsx` | 列表（折數、已過期、停用）、新增（到期日換算、去除空白）、未選到期日、`code` 重複、編輯、刪除提示、分頁、401 |
| `components/NavAdmin.test.jsx` | 登出撤銷 token、網路錯誤仍清除本機 token、後台連結 |
| `test/contract.test.js` | 契約檢查本身 |

### 撰寫原則

- 每個測試用 `renderRoutes`（`src/test/render.jsx`）建立新的 store 與 `MemoryRouter`，並帶上 `MessageToast`，提示訊息可以用 `.toast-body` 斷言。導向後的頁面用 `Landing` 代替。
- 假資料用 `src/test/fixtures.js` 組出來，欄位比照 spec 範例；`lineItem` 傳入優惠券時依 spec 的公式四捨五入。
- 需要後端狀態的流程（套用優惠券後重新讀取購物車），在測試裡用變數模擬，並記錄前端送出的請求來斷言。
- 從使用者的角度查詢元素（label、按鈕文字、role）。桌機與手機版的費用明細同時存在，用 `within` 限定在桌機版的卡片。
- `setup.js` 在每個測試後清除 cookie 與 axios 的預設 `Authorization`。後台頁的測試在 `beforeEach` 呼叫 `signInAsAdmin()`，模擬 `ProductedRoute` 驗證通過後的狀態。
- Bootstrap modal 用 `findDialog()` 等它開啟，開啟後才能用 role 查詢。**開過 modal 的測試要等它完全關閉再結束**（`waitForDialogClosed()`，或用 `closeDialog()` 按取消），動畫進行中就卸載元件的話，Bootstrap 的 callback 會丟錯。
- 要模擬網路錯誤時用 MSW 的 `http` 與 `HttpResponse.error()`，不經過契約檢查。

### 環境設定的注意事項

- 測試的環境變數寫在 `vitest.config.js`（API 網址為 `http://api.test/v2`、時區 `Asia/Taipei`），不受 `.env.local` 影響。
- `react-router-dom` 在 Node 下會載入 CJS 版並另外載入一份 react-router，Router context 不共用，所以設定 alias 改用 ESM 版。
- jsdom 的 `FormData`、`File` 與 Node 的 fetch 不相容，multipart 會被當成純文字，`setup.js` 改用 Node 內建的版本。
- 不使用 `createMemoryRouter`：data router 在 jsdom 下建立 `Request` 會與 Node 的 `AbortSignal` 衝突。頁面沒有用到 loader，用 `MemoryRouter` 即可。


## 端到端驗證

H2 無法完全代表 PostgreSQL，尤其是 `jsonb` 欄位。修改 entity 或 JSON 欄位後，請在真實環境驗證：

```bash
docker compose up -d db     # 在根目錄
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run
# 另開終端機
cd frontend && VITE_APP_API_BASE=http://localhost:8080/v2 npm run dev
```

也可以用 `docker compose up -d --build` 啟動完整環境（`http://localhost:8000`），更接近部署的狀態。在瀏覽器走完主要流程：

1. 以 `admin@gmail.com` 登入，進入後台。
2. 新增產品（含上傳圖片）與文章，並勾選啟用。
3. 到前台確認產品與文章出現。
4. 加入購物車、調整數量、填寫資料並送出訂單。
5. 確認成功頁的品項與總計。
6. 到後台修改訂單的付款與外送狀態，確認付款日期顯示正確。
7. 重新整理頁面，確認仍維持登入。
8. 後台新增優惠券；前台購物車套用優惠碼，確認優惠券折抵與總計；送出訂單後在成功頁付款，確認付款時間。

Bootstrap modal 在開啟動畫結束前會忽略 `hide()`，前端以 `utils/modal.js` 的 `createModal` 處理，送出後會等動畫結束再關閉。
