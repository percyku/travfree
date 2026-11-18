# GitHub、Facebook 登入

## 目標

- 前台可以用 GitHub、Facebook 登入或註冊。
- 會員中心可以連結、解除 GitHub、Facebook，與 Google 並列在「登入方式」。
- 沿用會員系統的第三方登入規則（`docs/plans/archive/2026-11-11-member-system.md` 的「決定」）：以平台的帳號 ID 辨識、撞 email 不自動合併（409）、至少保留一種登入方式、已被連結為第三方登入的 email 不能再註冊。

## 階段

每個階段都依序：改 spec → 後端與測試 → 前端與測試 → E2E → 更新 docs。

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 | GitHub 登入、通用的 OAuth 端點與回呼流程、`profile` 改回 `identities` | ✅ 完成（PR #7） |
| 2 | Facebook 登入（沿用階段 1 的流程） | 進行中：spec、後端、前端、E2E、文件完成，待使用者以真的 Facebook App 測試與 PR |

## 決定（2026-11-18 與使用者確認）

1. **兩者都用授權碼（authorization code）跳轉流程，不載入 Facebook SDK。** 前端把使用者導到平台的授權頁，平台帶 `code`、`state` 回到我們的網站，前端把 `code` 交給後端，後端用 client secret 換 token、取得使用者資料後發自己的 JWT。
   - `state`：前端產生的隨機字串，存在 `sessionStorage`，回來時比對，不符就中止（防 CSRF）。
   - GitHub 另外用 PKCE（`S256`）；Facebook 的網頁流程文件沒有 PKCE，只用 `state` 與 client secret。
2. **通用端點**，`{provider}` 只接受 `github`、`facebook`，Google 的端點維持原樣。
3. **`profile` 改回 `identities` 陣列**，取代 `google_email`，會員中心依陣列列出各平台的連結狀態。
4. **平台沒有提供 email 時，不能用它建立新帳號**（400，提示改用其他方式註冊）；已登入的帳號仍可連結。
   - GitHub：從 `GET /user/emails` 取 `primary` 且 `verified` 的 email；沒有就視為沒有 email。
   - Facebook：`/me?fields=id,name,email` 沒有 `email`（手機註冊的帳號，或使用者拒絕提供）就視為沒有 email。

### 回呼網址

前端用 `createHashRouter`，OAuth 的 `redirect_uri` 不能含 `#`，nginx 也沒有把其他路徑導回 `index.html`，所以 **`redirect_uri` 用網站根目錄**（例如 `http://localhost:8000/`）。

- 平台導回 `/?code=...&state=...`。前端在 `main.jsx` render 之前讀取 query，立刻用 `history.replaceState` 拿掉 query 並轉到 `#/oauth/callback`，由這頁完成登入。
- 立刻拿掉 query 的原因：nginx 與 Vite 為了 Google 設定 `Referrer-Policy: no-referrer-when-downgrade`，`code` 留在網址上會隨 Referer 送到外部資源。
- 是哪個平台、登入還是連結、登入後回到哪一頁，都記在 `sessionStorage` 裡以 `state` 為 key 的資料。

### 只用 GitHub／Facebook 的帳號設定密碼

比照 Google：設定時要重新以同一個平台驗證。前端跳轉時記下用途是「設定密碼」，回來後把 `code` 連同新密碼送到後端。

## 階段 1：GitHub

### API

- `GET /api/user/oauth/config`：公開。回傳各平台是否啟用與前端組授權網址需要的資料：
  `{ success, github: { enabled, client_id, authorize_url }, facebook: { ... } }`。
  `authorize_url` 由後端設定，E2E 才能指向假的服務。
- `POST /api/user/oauth/{provider}`：登入或註冊，`data: { code, redirect_uri, code_verifier? }`。
  - 已連結 → 登入；email 已有帳號或已是其他帳號連結的第三方 email → 409；沒有 email → 400；否則建立 `USER` 帳號並連結。
  - 姓名：GitHub 取 `name`，沒有時取 `login`；超過 30 字截斷。
  - 換 token 或取資料失敗 → 400 `GitHub 驗證失敗，請再試一次`；沒有設定 → 503。
- `POST /api/user/oauth/{provider}/link`、`DELETE /api/user/oauth/{provider}/link`：規則同 Google。解除時，帳號沒有密碼且沒有其他連結的平台 → 400。
- `PUT /api/user/password`：只用第三方登入的帳號設定密碼時，改為可以帶 `{ provider, code, redirect_uri, code_verifier? }` 重新驗證（Google 維持 `credential`）。細節在改 spec 時確定。
- `GET`/`PUT /api/user/profile` 等回傳 profile 的地方：移除 `google_email`，加上 `identities: [{ provider, email }]`（`email` 可為 null）。
- `redirect_uri` 由前端傳入，後端原樣交給平台換 token；平台會比對註冊的回呼網址，不符就換不到 token。

### 資料表

不用改。`user_identities` 已有 `provider`、`subject`、`email`；GitHub 的 `subject` 存數字 `id`（不用 `login`，使用者名稱可以改）。

### 設定

- 環境變數：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`（只在後端）。沒有設定時關閉，前台不顯示按鈕。
- `app.github.authorize-url`、`token-url`、`api-url` 預設為 GitHub 的網址，E2E 改成假的服務。
- 更新 `.env.example`、`docker-compose.yml`、`docs/README.md`（申請步驟）。

### 前端

- 登入頁、註冊頁加上「使用 GitHub 登入」。
- `#/oauth/callback` 頁：比對 `state`，呼叫後端，成功後合併訪客購物車並回到原本的頁面；失敗顯示錯誤並提供回登入頁的連結。
- 會員中心「登入方式」改成依 `identities` 列出 Google、GitHub、Facebook。

### 驗證

- 後端：用 `FakeGitHub`（JDK 的 `HttpServer`，所有測試共用）模擬 GitHub 的 token 與 user API，涵蓋新帳號、已連結、撞 email、沒有已驗證 email、換 token 失敗、未設定、連結與解除、設定密碼。
- 前端：Vitest 測試回呼頁（`state` 不符、成功、409）、按鈕的授權網址、會員中心的 `identities`。
- E2E：compose 加一個假的 OAuth 服務，走完「GitHub 註冊 → 登出 → 再登入」與「會員中心連結 GitHub」。
  - 授權頁（`GITHUB_OAUTH_AUTHORIZE_URL=https://github.e2e.test/...`）由 Playwright 攔截，回一個導回網站的頁面（`e2e/tests/oauth.js`）。
  - 換 token 與使用者 API 是 compose 的 `fake-oauth` 服務（原名 `fake-github`）（`profiles: ["e2e"]`，`e2e/fake-oauth.mjs`，只用 Node 內建模組）。
    不保存狀態：code 是帶著帳號、`redirect_uri`、`code_challenge` 的 base64url JSON，假服務檢查 client 帳密、`redirect_uri` 與 PKCE。

## 階段 2：Facebook

- 端點同階段 1，`provider` 為 `facebook`。
- 後端用 `GET /oauth/access_token` 換 token，最後 `GET /me?fields=id,name,email`（帶 `appsecret_proof`）。Graph API 版本寫在設定裡。
  原本打算用 `debug_token` 確認 `app_id`，實作時改為不呼叫：token 是後端以自己的 App Secret 用 code 換來的，不會是別的 app 的（`debug_token` 是給前端直接交 token 的 SDK 流程用的）。
- `subject` 存 app 專用的使用者 `id`。
- 環境變數：`FACEBOOK_APP_ID`、`FACEBOOK_APP_SECRET`。
- 驗證方式同階段 1。

## 進度

- 2026-11-18：確認決定 1–4，寫好計畫。
- 2026-11-18：spec 完成。另外決定：平台沒有回應或回 5xx 時回 502（與 code 無效的 400 分開）；GitHub 的 scope 只要 `user:email`；
  沒有密碼的帳號沒帶任何重新驗證時，訊息改為 `請重新以已連結的登入方式驗證`；解除連結時「還有其他已連結的平台」也算一種登入方式（Google 也適用）。
- 2026-11-18：後端完成（218 個測試通過）。第三方共用的規則抽到 `IdentityService`，Google 也改用它。
  測試改用真的 HTTP 假服務 `FakeGitHub`，而不是 `MockRestServiceServer`：RestClient 在 bean 裡建立，綁不到測試的 mock，
  而且這樣也測到逾時、狀態碼與 JSON 解析。Google 未驗證的 email 在連結時不再記錄（已連結的 email 會擋住別人註冊）。
  還沒在真實 PostgreSQL 上跑過，E2E 時一起確認。
- 2026-11-18：前端完成（194 個測試通過）。
  - code 不經過網址的 hash：`src/oauthRedirect.js` 是 `main.jsx` 的第一個匯入（`createHashRouter` 在匯入 App 時就讀網址），
    把 code 留在記憶體、網址換成 `#/oauth/callback`，所以重新整理回呼頁時流程已失效，要重新操作。
  - 用 GitHub 設定密碼時順序與 Google 相反：先驗證、回到會員中心再填新密碼（離開網站時填好的密碼會消失，也不把密碼存進 sessionStorage）。
    code 以 router state 帶回會員中心，取出後立刻清掉；GitHub 的 code 10 分鐘內有效。
  - 登入頁的第三方按鈕集中在 `SocialSignin`，只啟用 GitHub 時也顯示「或」的分隔線。
- 2026-11-18：E2E 完成，全部 12 個通過（新增 `github.spec.js` 2 個），這也是第一次在真實 PostgreSQL 上跑。
  故意讓假 GitHub 的 PKCE 檢查失敗時，兩個 GitHub 測試都會失敗。`scripts/e2e.sh` 與 CI 的 `.env` 加上 `COMPOSE_PROFILES=e2e` 與 `GITHUB_*`。
- 2026-11-18：PR #7 的 CI 中兩個 GitHub E2E 失敗：後端打 `/user` 收到 401。原因是 GitHub Actions 的 runner 預設有環境變數
  `GITHUB_API_URL=https://api.github.com`，docker compose 的 shell 環境變數優先於 `.env`，後端被導到真的 GitHub。
  只給 E2E 用的網址變數改名為 `GITHUB_OAUTH_AUTHORIZE_URL`、`GITHUB_OAUTH_TOKEN_URL`、`GITHUB_OAUTH_API_URL`（`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` 不是 runner 的預設變數，不變）。
  本機設定 `GITHUB_API_URL` 後以 prod profile 重現了失敗，改名後通過。
- 2026-11-18：PR #7 的 CI 通過、使用者在本機以真的 GitHub OAuth App 驗證後 merge（`028fd54`），階段 1 完成。
- 2026-11-18：階段 2（Facebook）在 `feature/facebook-signin` 實作。spec 只補 Facebook 的說明與沒有 email 的訊息（端點在階段 1 已定義）。
  - 後端：`FacebookOAuthClient`，與 GitHub 共用的設定、逾時與錯誤對應抽到 `AbstractOAuthClient`；沒有 email 的訊息改由各平台提供（`noEmailMessage()`）。
    不呼叫 `debug_token`（理由見上方階段 2），改為讀資料時帶 `appsecret_proof`。code 以樣板變數展開，`+` 等字元完整編碼。
  - 測試：`FakeFacebook` 與 `FacebookAuthApiTest`（後端 226 個）；前端 `FacebookSignin.test.jsx` 與會員中心的 Facebook 情境（201 個）；
    E2E 的假服務改名為 `fake-oauth` 並加上 Facebook，`facebook.spec.js` 2 個（全部 14 個通過）。故意讓 `appsecret_proof` 錯誤時，後端與 E2E 的 Facebook 測試都會失敗。
