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
| 1 | 角色改成多個、註冊與登入、`/api/user/check` 回傳角色、後台守衛只讓 `ADMIN` 進入 | ✅ 完成（PR #1，CI 通過） |
| 2 | 每個訪客各自的購物車、登入時合併、結帳需要 `USER`、訂單加上 `user_id`、`npm run seed:demo` | ✅ 完成（PR #1） |
| 3 | 會員中心：基本資料（姓名、電話、地址，結帳時預先填入）與變更密碼 | 進行中（`feature/member-profile`） |
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

## 階段 2

### API

| 端點 | 變更 |
|---|---|
| 購物車與優惠券（`GET`/`POST /cart`、`PUT`/`DELETE /cart/{id}`、`DELETE /carts`、`POST`/`DELETE /coupon`） | 依「誰在呼叫」決定是哪一台購物車：有 token 時是該帳號的購物車；沒有時看 `X-Cart-Id` header（訪客的購物車） |
| `POST /api/cart/merge` | 新增。需要登入。把 `X-Cart-Id` 的訪客購物車併入帳號的購物車，回應與 `GET /cart` 相同 |
| `POST /api/order` | 需要 `USER`：未登入 401、只有 `ADMIN` 403。結帳的是帳號的購物車，訂單記錄 `user_id` |

- `X-Cart-Id` 是前端產生的 UUID，存在 localStorage。格式錯誤回 400 `X-Cart-Id 格式不正確`。
- 有 token 時忽略 `X-Cart-Id`，只有 merge 會讀它。
- 沒有 token 也沒有 `X-Cart-Id`：讀取與刪除視為空的購物車；`POST /cart` 回 400 `缺少 X-Cart-Id`。
- 修改或刪除別台購物車的品項回 404 `找不到購物車品項`，不透露品項存在。
- 合併：同一個產品的數量相加，超過 9999 時以 9999 計；同一產品的優惠券以帳號購物車的為準，移過去的品項保留原本的優惠券。合併後刪除訪客購物車。重複呼叫不會重複合併。

### 資料表

- 新增 `carts(id, user_id UNIQUE NULL, guest_id UNIQUE NULL, created_at)`，`user_id` 與 `guest_id` 剛好一個有值。
- 購物車品項改存在新的 `cart_lines(id, cart_id, product_id, qty, coupon_id, created_at)`，`(cart_id, product_id)` 唯一。
  不沿用 `cart_items`：舊表的 `product_id` 有單欄唯一限制，而且新的 `cart_id` 要 `NOT NULL`，`ddl-auto=update` 都處理不了。
  舊的 `cart_items` 由啟動時的轉換移除，裡面的品項沒有擁有者，直接捨棄。
- `orders` 加上 `user_id`（可為 null，FK → users）。升級前的訂單是 null，不以 email 對應到會員。
- `LegacyUserSchemaMigration` 改名為 `LegacySchemaMigration`，一併處理 `cart_items`。

### 前端

- `utils/cart.js` 產生並保存 cart id，`cartSlice` 的每個請求帶上 `X-Cart-Id`。
- 會員登入或註冊成功後呼叫 merge，再重新讀取購物車；登出後重新讀取（變回訪客的購物車，是空的）。
- 購物車頁的「下一步」：未登入時導向 `/signin`，登入後回到填寫資料頁。
- 填寫資料頁：未登入導向 `/signin`；只有 `ADMIN` 時顯示不能結帳；以帳號的姓名與 email 預先填入。
- `authSlice` 加上 `checked`，確認完登入狀態前不做導向，否則重新整理填寫資料頁時會被誤導到登入頁。

### 展示資料 `npm run seed:demo`

- 透過 API 註冊（或登入）展示會員 `demo@example.com`，加入購物車並結帳兩筆訂單（一筆用 `Test50` 且已付款、一筆未付款）。需要先 `npm run seed`。
- 只允許 `API_BASE` 是 `localhost` 或 `127.0.0.1`，避免在部署環境建立公開密碼的帳號。
- 以後台訂單列表判斷是否已建立過（訂單 email 為展示帳號），重複執行不會重複下單。

### 驗證

- 後端：兩個訪客的購物車互不影響、會員與訪客分開、cart id 格式、別人的品項 404、merge 的數量相加與上限與優惠券、重複 merge、結帳的權限（401／403）、訂單的 `user_id`、結帳只清空自己的購物車、舊 `cart_items` 的轉換。
- 前端：請求帶 `X-Cart-Id`、登入後 merge、未登入導向登入頁、管理者不能結帳、預先填入姓名與 email。
- E2E：購物流程改為訪客加入購物車並套用優惠碼 → 結帳時登入 → 購物車與優惠帶過去 → 下單。
- 在 PostgreSQL 上以舊資料庫啟動一次。

## 階段 3

2026-11-13 使用者確認：基本資料有姓名、電話、地址，結帳時預先帶入；變更密碼一起做。

### API

| 端點 | 變更 |
|---|---|
| `GET /api/user/profile` | 新增。需要登入（任何角色）。回傳 `{ profile: { email, name, tel, address } }` |
| `PUT /api/user/profile` | 新增。需要登入。`{ data: { name, tel, address } }`，回傳更新後的 `profile` |
| `PUT /api/user/password` | 新增。需要登入。`{ data: { password, new_password } }`，成功時回應與登入相同（新的 token） |

- 身分以 token 判斷，網址不帶 id；`email` 不能修改，body 帶了也忽略。
- `name` 的規則與註冊相同。`tel` 與 `address` 選填，沒填的回傳空字串；沒帶或空字串都是清除。
  - `tel`：去掉前後空白後為 8–20 個數字，與結帳表單「只能數字、至少 8 碼」一致。
  - `address`：去掉前後空白後最多 100 個字。
- 變更密碼：
  - 目前的密碼錯誤回 400 `目前的密碼不正確`，並計入登入失敗次數（與登入共用，以 IP + 帳號計算），
    避免拿到 token 的人以這支猜密碼；鎖定時回 429。
  - 新密碼的規則與註冊相同，與目前的密碼相同時回 400 `新密碼不能與目前的密碼相同`。
  - 成功後該帳號所有既有 token 失效（其他裝置要重新登入），回應帶新的 token 讓目前的裝置維持登入。
- 階段 5 的 Google 帳號沒有密碼，到時再決定變更密碼頁怎麼處理。

### 資料表

- `users` 加上 `tel`（`varchar(20)`）與 `address`（`varchar(100)`），可為 null（未填）。`ddl-auto=update` 可以直接加上，不需要轉換。

### 前端

- 新增前台頁面 `/member`（會員中心），兩張卡片：基本資料（email 唯讀、姓名、電話、地址）與變更密碼（目前密碼、新密碼、確認新密碼）。
  未登入時導向 `/signin`，登入後回到會員中心。
- 儲存基本資料後 Header 的姓名跟著更新；變更密碼成功後保存新的 token。
- Header：md 以上的姓名改為連到會員中心；手機寬度登入後只有會員圖示連結，「登出」移到會員中心頁（圖示＋登出放不下，購物車會換行）。
- 在會員中心或填寫資料頁登出時先回首頁，否則頁面會把主動登出當成未登入，導向登入頁並提示「請先登入」。
- 填寫資料頁：以會員資料預先填入姓名、電話、地址，email 用帳號的；已經輸入的不覆蓋。
- `seed:demo` 的展示會員補上電話與地址。

### 驗證

- 後端：讀取與更新基本資料（各欄位驗證、清除、忽略 email）、未登入 401、管理者也能使用；變更密碼（成功後舊 token 失效、新 token 可用、新密碼可以登入、目前的密碼錯誤、與目前相同、規則、失敗次數鎖定）。
- 前端：會員中心的讀取、儲存、驗證訊息、變更密碼、未登入導向；Header 的連結；填寫資料頁預先填入電話與地址。
- E2E：註冊 → 會員中心填寫電話與地址 → 加入購物車 → 填寫資料頁已帶入 → 變更密碼 → 登出後以新密碼登入。
- 在 PostgreSQL 上以既有資料庫啟動，確認欄位新增。

## 進度

- 2026-11-11：建立分支與計畫，開始階段 1。
- 2026-11-11：階段 1 在本機完成。後端 118 個測試、前端 114 個測試、E2E 5 個全部通過。
  - 舊資料庫轉換在 PostgreSQL 上驗證過：把開發資料庫的備份還原到臨時容器後啟動，`role` 搬到 `user_roles`、姓名補為 `admin`，之後註冊、登入、403 都符合 spec。
  - spec 的 security scheme `AdminToken` 改名為 `Token`。
  - 原本打算在登入時擋下超過 72 bytes 的密碼，以免 bcrypt 丟例外；實測目前的 Spring Security 是回傳不符而不是丟例外，所以只保留測試。
  - 前端的 cookie 期限改用 `toUTCString()`（原本是 `Date` 的預設字串）。
- 2026-11-11：階段 1 推上 PR #1，CI 通過。使用者決定階段 2 完成後一起 merge。
- 2026-11-11：階段 2 在本機完成。後端 135 個測試、前端 125 個測試、E2E 5 個全部通過。
  - 在 PostgreSQL 上以開發資料庫的備份驗證轉換：`cart_items` 移除，6 筆舊訂單 `user_id` 為 null；之後訪客加入 → 合併 → 會員結帳 → admin 結帳 403 都符合 spec。
  - 測試用 `GuestCartTestConfig` 讓 MockMvc 預設帶 `X-Cart-Id`，既有的購物車測試不必修改；結帳的測試改以會員進行。
  - 故意拿掉 `POST /api/order` 的 `USER` 規則時，未登入結帳是 500（controller 拿不到帳號），由權限測試抓到；規則不可移除。
  - 填寫資料頁依賴 Header 確認的登入狀態（`auth.checked`），不另外呼叫 `/api/user/check`，避免重複請求。
  - `seed:demo` 在 E2E 環境驗證過：第一次 2 筆、第二次略過、密碼不同與非本機時拒絕。
  - 在開發資料庫執行時，`Test50` 是 11-09 修正前匯入的（到期日 2026-11-09，`seed` 不會更新已存在的資料），套用優惠碼時失敗，留下只建了帳號的狀態。
    改為建立任何資料前先檢查行程與優惠碼，不符合時說明原因並停止。經使用者同意，以後台 API 把開發資料庫的 `Test50` 到期日改為 2030-12-31。
  - 使用者在瀏覽器檢查時看到「缺少 X-Cart-Id」與管理者可以按送出：原因是分頁在重建前就開著，跑的是第 1 階段的前端（單頁應用換頁不會重新載入）。以全新的瀏覽器確認新版正確。
  - 使用者的手機寬度截圖顯示：階段 1 加上的「登入／註冊」讓購物車被擠到第二行。改為小於 md 時隱藏「註冊」與「後台」，並加上 360px 的 E2E 檢查。
- 2026-11-11：階段 2 推上 PR #1。CI 的 E2E job 連續兩次在「安裝 Playwright」失敗：`--with-deps` 用 apt 安裝字型，runner 解析不到 `azure.archive.ubuntu.com`（GitHub 狀態頁顯示正常）。前面的 smoke test、種子、展示會員、備份還原都通過。
  改為在 Playwright 官方映像檔（`v1.65.0-noble`）裡執行 E2E，版本取自 lock 檔，並加上 15 分鐘上限。本機以同一個映像檔對 E2E 環境跑過，6 個全部通過。
- 2026-11-11：改用映像檔後安裝只花幾秒，但「手機寬度的 Header 不換行」在 CI 失敗（量到 60）。CI 的截圖其實沒有換行：購物車圖示是 Google Fonts 的 Material Icons，字型到之前顯示很寬的文字 `shopping_cart`，CI 下載字型較慢，測試量到了這個瞬間。在本機以延遲 2 秒的字型重現同樣的 60，改為等圖示字型載入後再量（8）。
- 2026-11-13：開始階段 3，建立 `feature/member-profile` 分支。
- 2026-11-13：階段 3 在本機完成。後端 162 個測試、前端 142 個測試、E2E 7 個全部通過。
  - 手機寬度原本打算在 Header 放「會員圖示＋登出」，E2E 的 360px 檢查失敗（購物車被擠到第二行，量到 60）。改為手機只放圖示，登出移到會員中心頁。
  - 前台登出後重新讀取購物車的動作原本放進共用的 `signout`，後台導覽列的登出測試因此多了沒定義的 `GET /api/cart` 而失敗；改成前台專用的 `memberSignout`。
  - 以反向驗證確認「會員資料回來前已輸入的不覆蓋」測試有效：拿掉「欄位是空的才填」的判斷時該測試失敗。
  - 在開發資料庫（PostgreSQL，先 `db:backup`）以新版啟動：`users` 新增 `tel varchar(20)`、`address varchar(100)`；`seed:demo` 補上展示會員的電話地址，第二次略過；以展示會員實測讀取、格式錯誤 400、改密碼後舊 token 401／新 token 200，之後把密碼改回 `Demo2026`。
