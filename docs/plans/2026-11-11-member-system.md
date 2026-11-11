# 會員系統

## 目標

- 前台可以註冊、登入（之後加上 Google，再之後 GitHub、Facebook）。
- 角色分為一般會員（`USER`）與管理者（`ADMIN`），可以同時擁有兩種。
- 訪客可以加入、刪除購物車商品與修改數量；結帳需要 `USER`。
- 會員在前台的會員中心編輯自己的基本資料，email 不能改。
- 管理者在 dashboard 把既有會員升級為管理者；升級後不能在後台修改自己的訂單。

## 階段

每個階段都依序：改 spec → 後端與測試 → 前端與測試 → E2E → 更新 docs。

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 | 角色改成多個、註冊與登入、`/api/user/check` 回傳角色、後台守衛只讓 `ADMIN` 進入 | 本機完成，待 commit 與 CI |
| 2 | 每個訪客各自的購物車、登入時合併、結帳需要 `USER`、訂單加上 `user_id` | 未開始 |
| 3 | 會員中心的基本資料頁 | 未開始 |
| 4 | dashboard 的會員列表與升級／降級、禁止管理者修改自己的訂單 | 未開始 |
| 5 | Google 登入 | 未開始 |

## 決定（2026-11-11 與使用者確認）

- **角色用疊加的方式。** `users` 的單一 `role` 欄位改成 `user_roles` 表。註冊時給 `USER`；升級是加上 `ADMIN`，不移除 `USER`，所以升級後仍然可以結帳。
- **種子帳號 `admin@gmail.com` 只有 `ADMIN`**，是純後台帳號，不能結帳。
- **主鍵維持 UUID。** email 為 `UNIQUE NOT NULL` 且不能修改。JWT 的 subject、`uid` 與之後訂單的外鍵都用 UUID。
- **管理者可以被降級**，但不能降級自己，也不能移除最後一個管理者（階段 4）。
- **「不能修改自己的訂單」以訂單的 `user_id` 判斷**，不看角色組合，也不比對訂單表單上的 email（使用者可以填任何 email）（階段 2、4）。
- **訪客購物車**：前端產生 cart id 存在 localStorage，以 header 帶給後端；登入時合併到會員的購物車（階段 2）。
- **個人資料放前台的會員中心**，後端以 token 判斷身分，網址不帶 id（階段 3）。
- **Google 登入**：前端用 Google Identity Services 取得 ID token，後端驗證後發自己的 JWT。Google 的 email 與既有帳號相同且 `email_verified` 時，視為同一個帳號（階段 5）。
- 在 `feature/member-system` 分支開發，開 PR 讓 CI（含 E2E）通過後再 merge。

## 階段 1

### API

| 端點 | 變更 |
|---|---|
| `POST /api/user/signup` | 新增。公開。`{ data: { email, password, name } }`，成功時直接登入，回應與登入相同 |
| `POST /api/user/signin` | 新增。公開。前台登入，任何帳號都可以登入，回應與 `/admin/signin` 相同，共用登入次數限制 |
| `POST /admin/signin` | 沒有 `ADMIN` 的帳號回 403 `此帳號沒有後台權限`（密碼錯誤仍回 400 `登入失敗`） |
| `POST /api/user/check` | 回應加上 `email`、`name`、`roles` |

- email 前後空白會去掉並轉成小寫；兩支登入 API 也一樣，所以 `Admin@Gmail.com` 可以登入。
- 密碼 8–64 個字元，只能用英數與半形符號（不含空白），至少要有一個英文字母與一個數字。
  限制為 ASCII 是因為 bcrypt 只處理前 72 bytes，中文等多位元組字元會讓長度難以預期。
- 姓名去掉前後空白後 1–30 個字。

### 資料表

- `users` 加上 `name`（`varchar(30)`）。DDL 允許 null，因為 `ddl-auto=update` 無法對有資料的表加上 `NOT NULL` 欄位；程式保證寫入時一定有值。
- 新增 `user_roles(user_id, role)`，主鍵為兩欄合併。
- 舊資料庫（有 `users.role` 欄位）在啟動時自動轉換：把 `role` 複製到 `user_roles`、移除 `role` 欄位、沒有 `name` 的帳號以 email 的 `@` 前面當姓名。轉換可以重複執行。還原舊備份後重新啟動後端也會轉換（`db:restore` 會重新啟動後端）。

### 前端

- 新增 `utils/auth.js`，集中 token cookie 的讀寫，取代 `Login`、`ProductedRoute`、`NavAdmin` 中重複的程式。
- 新增 `authSlice`：啟動時讀 cookie、呼叫 `/api/user/check`，存下 `email`、`name`、`roles`。
- 新增前台頁面 `/signin`、`/signup`；Header 未登入時顯示「登入／註冊」，登入後顯示姓名與「登出」，管理者多一個「後台」連結。
- `ProductedRoute` 要求 `roles` 含 `ADMIN`。
- `Login`（後台登入）只在 token 有 `ADMIN` 時自動進入後台，否則停在登入頁，避免一般會員的 token 在兩頁之間來回導向。

### 驗證

- 後端：註冊（成功、重複 email、大小寫不同的重複 email、各欄位驗證）、前台登入、後台登入拒絕一般會員、`/user/check` 的角色、一般會員不能呼叫 admin API、舊資料庫轉換。
- 前端：註冊頁、登入頁、Header 的登入狀態、後台守衛拒絕一般會員、後台登入頁不會自動導向。
- E2E：註冊 → Header 顯示姓名 → 登出 → 再登入；一般會員進不了後台。
- 在真實 PostgreSQL 上以舊資料庫啟動一次，確認轉換成功。

## 進度

- 2026-11-11：建立分支與計畫，開始階段 1。
- 2026-11-11：階段 1 在本機完成。後端 118 個測試、前端 114 個測試、E2E 5 個全部通過。
  - 舊資料庫轉換在 PostgreSQL 上驗證過：把開發資料庫的備份還原到臨時容器後啟動，`role` 搬到 `user_roles`、姓名補為 `admin`，之後註冊、登入、403 都符合 spec。
  - spec 的 security scheme `AdminToken` 改名為 `Token`。
  - 原本打算在登入時擋下超過 72 bytes 的密碼，以免 bcrypt 丟例外；實測目前的 Spring Security 是回傳不符而不是丟例外，所以只保留測試。
  - 前端的 cookie 期限改用 `toUTCString()`（原本是 `Date` 的預設字串）。
