# 測試規範

## 執行方式

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test

cd frontend
npm test              # 執行一次；npm run test:watch 會持續監看

npm run e2e           # 在根目錄，E2E（需要 Docker），見下方「E2E 測試」
```

後端不需要 Docker。測試使用 `test` profile 與 H2 記憶體資料庫的 PostgreSQL 模式，設定在 `src/test/resources/application-test.properties`。

## CI

`.github/workflows/ci.yml`：push 到 `main` 或開 PR 時，GitHub Actions 在 Linux 上同時跑四個 job，結果在 repo 的 **Actions** 分頁：

| Job | 內容 |
|---|---|
| OpenAPI spec | `npm run openapi:lint` |
| 後端測試 | `./mvnw -B test`（Java 21、H2，不需要資料庫服務）。失敗時可下載 `backend-surefire-reports` 查看細節 |
| 前端 lint、測試與建置 | `npm run lint`、`npm test`、`npm run build` |
| Docker compose 與 E2E | 以 prod profile 與隨機產生的密鑰，`docker compose up -d --build --wait` 啟動全新的資料庫與前後端，再跑 `scripts/smoke-test.sh`；接著匯入種子資料兩次（第二次應全部略過），再備份 → `down -v` → 還原，確認種子資料都還在；最後執行 E2E。失敗時輸出各服務的 log，並上傳 `e2e-report`（Playwright 報告） |

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

新功能依變動的範圍補上測試：

| 變動 | 至少要有 |
|---|---|
| 後端新 API | 通過契約驗證的成功情境，以及主要錯誤情境的狀態碼與訊息（見下方「撰寫原則」） |
| 前端新頁面或互動 | Vitest 測試，MSW handler 用 `api.*` 定義，請求與回應會對 spec 檢查（見「前端測試」） |
| 新增或改變主要使用流程 | `e2e/tests/` 的 Playwright 測試（見「E2E 測試」） |

各層分工：後端與前端的測試涵蓋細節與錯誤情境，速度快、失敗時容易找到原因；E2E 只走主要流程，確認前端、nginx、後端與資料庫串起來可以運作。push 前跑過相關測試，CI 會再跑一次全部的檢查。

## 測試結構

整合測試為主，用 `@SpringBootTest` 啟動完整應用，走真實的 Security、JWT 與資料庫流程，不 mock service。這個專案的主要風險是 API 契約與前端不一致，單元測試抓不到這類問題。

| 測試 | 涵蓋範圍 |
|---|---|
| `AuthApiTest` | 後台登入、token 格式、`/user/check` 的角色、登出撤銷、無效 token 不影響公開 API、Admin 路由權限 |
| `MemberAuthApiTest` | 註冊（email 正規化、重複、各欄位驗證與邊界）、前台登入、後台登入拒絕會員且不計入失敗、前後台共用次數限制、會員 token 呼叫 Admin API 回 403、超過 bcrypt 72 bytes 的密碼 |
| `LegacySchemaMigrationTest` | 舊的 `users.role` 欄位轉換為 `user_roles`、補上姓名、移除共用購物車的 `cart_items`、重複執行不變 |
| `CartOwnershipApiTest` | 訪客之間、訪客與會員的購物車互不影響、會員忽略 `X-Cart-Id`、沒有或格式錯誤的 `X-Cart-Id`、別人的品項 404、優惠券只套用自己的、刪除產品從所有購物車移除；合併的數量相加與上限、優惠券、建立會員購物車、重複合併、權限，合併後結帳 |
| `LoginRateLimitApiTest` | 登入次數限制：帳號鎖定、密碼正確也擋、換 IP 不受影響、IP 總量、成功歸零、429 與 `Retry-After` |
| `ProductApiTest` | 產品 CRUD、上下架連動、分頁、排序、分類、驗證訊息 |
| `ArticleApiTest` | 文章 CRUD、公開與否的連動、`content` 可見範圍、`create_at` 原值保存 |
| `CartApiTest` | 購物車、數量累加、即時計價、優惠券計算、優惠券管理 |
| `OrderApiTest` | 結帳需要 `USER`（401／403）、訂單記錄下單帳號、只清空帳號的購物車、訂單快照、付款、Admin 更新、時間單位 |
| `UploadApiTest` | 圖片上傳與讀取、內容檢查、大小限制 |
| `HttpContractTest` | 走真實 Tomcat：`/v2` 前綴、CORS、超過上傳上限的回應 |
| `BackendApplicationTests` | 應用程式可以啟動 |
| `security.LoginAttemptLimiterTest` | 單元測試：鎖定到期、計數視窗過期、鎖定不延長、秒數進位。整合測試無法快轉時鐘 |
| `config.ProductionConfigCheckTest` | prod profile 缺少密鑰、使用預設值、密鑰太短時拒絕啟動，含真實啟動一次確認註冊與設定檔生效 |
| `OpenApiContractConfig` | 不是測試，讓所有 MockMvc 回應都對 spec 驗證 |
| `GuestCartTestConfig` | 不是測試，讓所有 MockMvc 請求預設帶同一個訪客的 `X-Cart-Id`，與前端相同 |

`ApiTestSupport` 是共用基底：每個測試前清空業務資料、預設 admin 以外的帳號與登入次數計數並重新登入，也提供註冊會員（`signupMember`）、建立產品、加入購物車、結帳等輔助方法。購物的輔助方法（`addToCart`、`checkout`、`shopperPost`、`asShopper`）預設以訪客身分呼叫，設定 `shopperToken` 後改以該會員呼叫；結帳需要會員，所以 `OrderApiTest` 在 `@BeforeEach` 設定它。要指定另一個訪客時用 `asGuest(request, cartId)`。MockMvc 請求都來自 `127.0.0.1`，要測不同 IP 時用 `.with(request -> { request.setRemoteAddr(...); return request; })`。

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
- 需要 `Token` 的端點必須帶 `Authorization` header。
- multipart 請求（圖片上傳）必須帶 spec 要求的欄位，例如 `file-to-upload`。
- 測試假資料必須符合該狀態碼的回應 schema，spec 沒列出的狀態碼要符合 `default`。假資料和 spec 不一致時，先判斷是假資料錯還是 spec 錯。
- 測試中出現沒有定義 handler 的請求也算違規，可以用來確認「不應該呼叫 API」的情境。

`src/test/contract.test.js` 確認上述檢查本身有效。

### 測試結構

| 測試 | 涵蓋範圍 |
|---|---|
| `utils/coupon.test.js` | 到期日秒數換算、折數文字、是否過期、優惠券摘要、千分位 |
| `pages/front/CartCheckout.test.jsx` | 費用明細金額、套用/移除優惠券、無效優惠碼、之後加入的品項提示、調整數量、刪除與清空、空購物車 |
| `pages/front/CartForm.test.jsx` | 預先填入帳號的姓名與 email、未登入導向登入頁、確認登入前不導向、只有 `ADMIN` 不能結帳、`USER`＋`ADMIN` 可以結帳、進入頁面重新讀取購物車、欄位驗證、送出時帶 `final_total`、409 金額變動、空購物車不能送出 |
| `utils/cart.test.js` | `X-Cart-Id` 的產生與保存、非安全來源與 localStorage 無法使用時的備案、購物車請求帶上 header |
| `pages/front/CartSuccess.test.jsx` | 訂單品項與總計、付款後顯示付款時間、付款失敗、找不到訂單 |
| `pages/Login.test.jsx` | 後台登入成功寫入 cookie、400/403/429 顯示後端原因、欄位驗證、已登入直接進後台、會員 token 不自動進入、token 失效；後台路由保護（會員導向登入頁但保留 cookie、`USER`+`ADMIN` 可進入） |
| `pages/front/MemberSignin.test.jsx` | 會員登入寫入 cookie 與歡迎訊息、登入後合併訪客購物車並更新、合併失敗仍完成登入、回到來源頁、400/429 顯示後端原因、欄位驗證、已登入直接離開 |
| `pages/front/MemberSignup.test.jsx` | 註冊後是登入狀態、送出的內容（去空白、不送確認密碼）、email 已註冊、密碼規則、確認密碼與姓名長度 |
| `components/Header.test.jsx` | 未登入不呼叫 `/user/check`、會員顯示姓名與登出、管理者的後台連結、登出 |
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
- `/api/user/check` 的回應用 `fixtures.js` 的 `adminUser()`、`memberUser()` 組出來，登入與註冊的回應用 `signinSuccess(token)`。需要「已登入」的 store 時用 `preloadedState: { auth: { user: memberUser(), checked: true } }`。
- 會員登入或註冊成功後會呼叫 `/api/cart/merge` 與 `/api/cart`，用 `test/handlers.js` 的 `useCartMerge()` 定義，它會回傳收到的 merge 請求。
- `setup.js` 在每個測試後也清除 localStorage，所以每個測試的 `X-Cart-Id` 都不同。
- Bootstrap modal 用 `findDialog()` 等它開啟，開啟後才能用 role 查詢。**開過 modal 的測試要等它完全關閉再結束**（`waitForDialogClosed()`，或用 `closeDialog()` 按取消），動畫進行中就卸載元件的話，Bootstrap 的 callback 會丟錯。
- 要模擬網路錯誤時用 MSW 的 `http` 與 `HttpResponse.error()`，不經過契約檢查。

### 環境設定的注意事項

- 測試的環境變數寫在 `vitest.config.js`（API 網址為 `http://api.test/v2`、時區 `Asia/Taipei`），不受 `.env.local` 影響。
- `react-router-dom` 在 Node 下會載入 CJS 版並另外載入一份 react-router，Router context 不共用，所以設定 alias 改用 ESM 版。
- jsdom 的 `FormData`、`File` 與 Node 的 fetch 不相容，multipart 會被當成純文字，`setup.js` 改用 Node 內建的版本。
- 不使用 `createMemoryRouter`：data router 在 jsdom 下建立 `Request` 會與 Node 的 `AbortSignal` 衝突。頁面沒有用到 loader，用 `MemoryRouter` 即可。


## E2E 測試

Playwright（Chromium）在真實瀏覽器中，對 docker compose 環境（nginx、後端、PostgreSQL）走完主要流程。測試在 `e2e/`。

```bash
npm run e2e                               # 在根目錄執行
npm run e2e -- --headed                   # 開啟瀏覽器視窗觀看
npm run e2e -- tests/shopping.spec.js     # 只跑一個檔案
E2E_KEEP=1 npm run e2e                    # 結束後保留環境（http://localhost:8100）
cd e2e && npm run report                  # 查看上一次的 HTML 報告（失敗時含截圖、錄影與 trace）
```

`npm run e2e`（`scripts/e2e.sh`）會啟動**獨立的環境**：專案名稱 `travfree-e2e`、網站 `:8100`、資料庫 `:5433`、全新的 volume，匯入種子資料後執行測試，結束時整套刪除。平常用的 `:8000` 環境與資料不受影響，也不會讀根目錄的 `.env`。第一次執行會安裝 Playwright 與 Chromium。

| 測試 | 涵蓋範圍 |
|---|---|
| `shopping.spec.js` | 訪客從首頁搜尋 → 行程頁加入購物車 → 套用優惠碼 `Test50` → 前往結賬時導向登入頁 → 登入後回到填寫資料頁，購物車與優惠帶到帳號、收件資料預先填入 → 送出訂單 → 成功頁付款 → 購物車已清空 |
| `admin-products.spec.js` | 後台登入、新增並上架產品 → 前台行程列表看得到 → 後台刪除 → 前台看不到 |
| `admin-orders.spec.js` | 以 API 註冊會員並下單 → 後台訂單列表看得到 → 改為已付款、外送中 → 重新開啟確認 → API 查詢確認 |
| `member.spec.js` | 首頁註冊 → Header 顯示姓名 → 重新整理仍登入 → 登出 → 以大小寫不同的 email 再登入；會員開啟後台被導向後台登入頁 → 會員帳號被拒 → 改用管理者登入；360px 寬時 Header 不換行（jsdom 不套用 CSS，只能在這裡測） |

### 查看報告

每次執行都會產生新的 HTML 報告，覆蓋上一次的。

```bash
cd e2e && npm run report      # 開啟 http://localhost:9323，看完按 Ctrl+C 關閉
```

- 每個測試列出 `test.step` 的步驟與耗時，點進去可以看到每一步的操作。
- **失敗的測試**另外附上：失敗當下的截圖、整段操作的錄影、trace。點 trace 會開啟 Trace Viewer，可以逐步看每個操作前後的畫面、當時的 DOM、網路請求與 console。
- 通過的測試預設不保存截圖與 trace。想看完整過程時執行 `npm run e2e -- --trace on`。

**CI 失敗時**：到 GitHub 的 Actions 頁面，打開失敗的那次執行，在頁面下方的 **Artifacts** 下載 `e2e-report`，解壓縮後：

```bash
cd e2e && npx playwright show-report <解壓縮的資料夾>/playwright-report
npx playwright show-trace <解壓縮的資料夾>/test-results/<測試名稱>/trace.zip   # 只看 trace
```

trace 也可以直接拖曳到 [trace.playwright.dev](https://trace.playwright.dev) 查看，不需要安裝。

### 撰寫原則

- **依賴種子資料**（`scripts/seed/data.json`）：購物測試使用「台北3日遊」與優惠碼 `Test50`，修改種子時要一併確認。
- **購物車全站共用**，測試依序執行（`workers: 1`），需要購物車的測試在開始前清空。
- 測試建立的資料加上 `uniqueId()`，不依賴執行順序，也不依賴資料庫是否全新。
- 和 Vitest 一樣，從使用者的角度查詢元素（label、按鈕文字、role）。桌機版的費用明細用「費用明細」卡片限定範圍。
- 準備資料（例如後台測試需要的訂單）可以直接呼叫 API（`placeOrderByApi`），測試本身走畫面。
- 不重試（`retries: 0`）：不穩定的測試要修正，而不是被重試蓋過。
- 共用的操作放在 `e2e/tests/helpers.js`。

### 手動驗證

E2E 還沒涵蓋的項目，修改相關功能後請在瀏覽器確認：

- 上傳圖片、新增與編輯文章，前台文章頁的顯示。
- 重新整理頁面後仍維持登入、登出。
- 修改 entity 或 JSON 欄位後，在真實 PostgreSQL 上走一次相關流程（H2 無法完全代表 PostgreSQL，尤其是 `jsonb` 欄位）。

Bootstrap modal 在開啟動畫結束前會忽略 `hide()`，前端以 `utils/modal.js` 的 `createModal` 處理，送出後會等動畫結束再關閉。
