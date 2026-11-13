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
| 3 | 會員中心：基本資料（姓名、電話、地址，結帳時預先填入）與變更密碼 | ✅ 完成（PR #2） |
| 4 | dashboard 的會員列表與升級／降級、禁止管理者修改自己的訂單 | ✅ 完成（PR #3） |
| 5 | Google 登入、會員中心連結 Google 與設定密碼 | ✅ 完成（PR #4） |

## 決定（2026-11-11 與使用者確認）

- **角色用疊加的方式。** `users` 的單一 `role` 欄位改成 `user_roles` 表。註冊時給 `USER`；升級是加上 `ADMIN`，不移除 `USER`，所以升級後仍然可以結帳。
- **種子帳號 `admin@gmail.com` 只有 `ADMIN`**，是純後台帳號，不能結帳。
- **主鍵維持 UUID。** email 為 `UNIQUE NOT NULL` 且不能修改。JWT 的 subject、`uid` 與之後訂單的外鍵都用 UUID。
- **管理者可以被降級**，但不能降級自己，也不能移除最後一個管理者（階段 4）。
- **「不能修改自己的訂單」以訂單的 `user_id` 判斷**，不看角色組合，也不比對訂單表單上的 email（使用者可以填任何 email）（階段 2、4）。
- **訪客購物車**：前端產生 cart id 存在 localStorage，以 header 帶給後端；登入時合併到會員的購物車（階段 2）。
- **個人資料放前台的會員中心**，後端以 token 判斷身分，網址不帶 id（階段 3）。
- **Google 登入**：前端用 Google Identity Services 取得 ID token，後端驗證後發自己的 JWT（階段 5）。
- **第三方帳號以平台的帳號 ID 辨識，email 相同也不自動合併**（2026-11-13 改，取代原本「email 相同且 `email_verified` 視為同一帳號」）。
  - 原因：註冊不寄驗證信，帳號的 email 不代表擁有那個信箱。自動合併會讓先用別人 email 註冊的人，在本人以 Google 登入後仍能用密碼登入（搶先註冊攻擊）。
  - 第三方登入撞到既有帳號的 email 時回 409，請使用者先用原本的方式登入，再到會員中心連結。之後加 GitHub、Facebook 也用同一條規則；它們的 email 可能未驗證或沒有。
  - 先第三方、後註冊：註冊照樣回「此 Email 已註冊」，訊息引導改用原本的方式（例如 Google）。只用第三方登入的帳號可以在會員中心設定密碼，設定時要重新以第三方驗證。
  - 解除連結時至少要保留一種登入方式。
  - 已被連結為第三方登入的 email 視同已被使用，不能再用它註冊（2026-11-13 使用者測試後追加）。反方向（先有人用這個 email 註冊）不擋連結。
  - 被搶先註冊的本人無法使用自己的 email，要等「忘記密碼（寄信）」才能根治，目前由管理者處理。之後若做 email 驗證，驗證過的帳號可以考慮自動合併。
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

## 階段 4

### API

| 端點 | 變更 |
|---|---|
| `GET /api/admin/users` | 新增。Admin。會員分頁（每頁 10 筆，新到舊），`q` 以 email 或姓名搜尋（部分符合、不分大小寫） |
| `PUT /api/admin/user/{id}` | 新增。Admin。`{ data: { is_admin: true\|false } }` 加上或移除 `ADMIN`，回傳更新後的帳號 |
| `PUT`/`DELETE /api/admin/order/{id}`、`DELETE /api/admin/orders/all` | 訂單的 `user_id` 是呼叫者時回 403 `不能修改自己的訂單` |
| `GET /api/admin/orders`、`GET /api/orders` | 訂單多回 `user_id`（下單的帳號），前端用來判斷是不是自己的訂單。前台的訂單 API 不回 |

- 列表每筆是 `{ id, email, name, roles, create_at }`，`create_at` 是 Unix **秒**（與訂單相同）。
- 升級只加上 `ADMIN`，不動 `USER`；已經是管理者時不做事，回 200。
- 降級移除 `ADMIN`。帳號因此沒有任何角色時（例如只有 `ADMIN` 的預設 admin）補上 `USER`，帳號不會沒有角色。
- 不能移除自己的 `ADMIN`：400 `不能移除自己的管理者權限`。
- 至少保留一位管理者：400 `至少要保留一位管理者`。因為不能降級自己，循序呼叫時遇不到；
  兩位管理者同時互相降級時會遇到，所以計數前以 `SELECT ... FOR UPDATE` 鎖住所有管理者。
- 角色每次請求都從資料庫讀取，降級立即生效，不需要撤銷 token。
- `DELETE /orders/all` 只要有一筆是自己的就整個拒絕，不刪除任何訂單（前端沒有使用這支）。
- 會員系統之前的訂單 `user_id` 是 null，任何管理者都可以修改。

### 前端

- 後台新增「會員列表」（`/admin/users`）：搜尋、分頁，每列顯示 email、姓名、角色、註冊時間與「設為管理者」或「移除管理者」。
  自己那一列不能移除，變更前以對話框確認。
- 後台訂單列表：自己的訂單標示「自己的訂單」，明細對話框的付款與外送狀態不能修改、沒有儲存按鈕。以 `user_id` 與 `/api/user/check` 的 `uid` 比對。

### 驗證

- 後端：列表（分頁、排序、搜尋、角色）、升級、降級、預設 admin 降級後變成 `USER`、不能降級自己、最後一位管理者（直接呼叫 service）、不存在的帳號 404、一般會員 403；
  修改或刪除自己的訂單 403、別人的與舊訂單可以、全部刪除含自己的訂單時 403；`user_id` 出現在後台訂單、不出現在前台訂單。
- 前端：會員列表的顯示、搜尋、分頁、升級、降級、自己不能移除、錯誤訊息；訂單列表自己的訂單不能修改。
- E2E：管理者把新會員升級 → 會員進得了後台 → 會員（同時有 `USER`）結帳 → 在後台看到自己的訂單不能修改 → 管理者降級後進不了後台。

## 階段 5

### API

| 端點 | 變更 |
|---|---|
| `GET /api/user/google/config` | 新增。公開。`{ enabled, client_id }`，前端執行時讀取，client ID 只需在後端設定一處 |
| `POST /api/user/google` | 新增。公開。`{ data: { credential } }`（GIS 的 ID token）。已連結的 Google 帳號登入；新的 email 建立帳號；email 已有帳號回 409 |
| `POST /api/user/google/link` | 新增。需要登入。把 Google 帳號連結到目前的帳號，回傳 `profile` |
| `DELETE /api/user/google/link` | 新增。需要登入。解除連結，回傳 `profile`；沒有密碼時不能解除 |
| `GET`/`PUT /api/user/profile` | `profile` 多回 `has_password` 與 `google_email`（未連結為 null） |
| `PUT /api/user/password` | 沒有密碼的帳號改帶 `credential`（重新以已連結的 Google 驗證）設定密碼 |
| `POST /api/user/signup` | email 已存在的訊息改為 `此 Email 已註冊，請改用原本的方式登入（例如 Google）` |

- ID token 依 Google 文件驗證：簽章（Google 的 JWKS）、`aud` 是我們的 client ID、`iss` 是 `accounts.google.com` 或 `https://accounts.google.com`、未過期。
- 以 `sub` 辨識 Google 帳號；email 只在建立新帳號時使用，且要 `email_verified`。
- 新帳號的角色是 `USER`，姓名取 Google 的 `name`（超過 30 個字截斷，沒有時取 email 的 `@` 前面），沒有密碼。
- Google 登入的錯誤：token 無效 400 `Google 驗證失敗，請再試一次`；建立帳號時 email 未驗證 400 `Google 帳號的 Email 尚未驗證`；
  email 已有帳號 409 `此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Google`；後端沒有設定 client ID 時 503 `未設定 Google 登入`。
- 連結：這個 Google 帳號已連結別的會員 409；目前的帳號已連結另一個 Google 帳號 409（先解除）；已連結同一個時不做事。Google 的 email 可以與帳號的 email 不同（使用者已登入又通過 Google 驗證）。
- 用密碼登入沒有密碼的帳號：回 `登入失敗`，計入失敗次數，不透露帳號沒有密碼。
- 設定密碼後所有既有 token 失效並回傳新 token，與變更密碼相同；`credential` 的 `sub` 必須是已連結的 Google 帳號。

### 資料表

- 新增 `user_identities(id, user_id, provider, subject, email, created_at)`，`(provider, subject)` 唯一、`(user_id, provider)` 唯一。之後的 GitHub、Facebook 也存在這裡。
- `users.password_hash` 改為可為 null。`ddl-auto=update` 不會移除 `NOT NULL`，由 `LegacySchemaMigration` 處理。

### 設定

- 後端 `GOOGLE_CLIENT_ID`（`app.google.client-id`），沒有設定時 Google 登入關閉，前端不顯示按鈕。
- 後端 `GOOGLE_TEST_PUBLIC_KEY`：只給 E2E 用，設定時改用這把公鑰驗證，不連 Google；啟動時記錄警告。
- nginx 與 Vite 開發伺服器加上 `Referrer-Policy: no-referrer-when-downgrade`（Google 要求以 http://localhost 測試時設定；路由在 `#` 之後，不會送出頁面路徑）。

### 前端

- 登入頁與註冊頁加上 Google 按鈕（GIS `renderButton`）。409 時顯示原因。登入頁加上提示：用 Google 註冊的帳號請按 Google 登入。
- 會員中心新增「登入方式」卡片：密碼（已設定／未設定）、Google（已連結的 email 與解除連結／連結按鈕）。
- 沒有密碼的帳號，「變更密碼」卡片改為「設定密碼」：輸入新密碼後按 Google 按鈕重新驗證。

### 驗證

- 後端：以測試用的金鑰簽出 ID token；登入、建立帳號、409、email 未驗證、token 無效（簽章、`aud`、`iss`、過期）、未設定 client ID；連結與解除連結的各種情況；沒有密碼的帳號用密碼登入失敗；設定密碼；舊資料庫的 `password_hash` 轉換。
- 前端：以假的 GIS 物件測試按鈕的流程與錯誤訊息、會員中心的登入方式與設定密碼。
- E2E：Playwright 攔截 GIS 的 script 換成假的按鈕，以測試金鑰簽出 token（後端設定對應的公鑰）：Google 新帳號 → 設定密碼 → 登出後用密碼登入；既有 email 的 409 → 用密碼登入後連結 → 之後用 Google 登入。
- 真的 Google 帳號由使用者在本機設定 client ID 後手動確認。

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
- 2026-11-13：PR #2 merge。開始階段 4，建立 `feature/member-admin` 分支。
- 2026-11-13：階段 4 在本機完成。後端 175 個測試、前端 154 個測試、E2E 8 個全部通過。
  - 「至少保留一位管理者」在 PostgreSQL 上驗證：E2E 環境中兩位管理者同時互相移除 30 次，每次都恰好一邊 200、一邊 400；暫時拿掉 `lockAllByRole` 重建後，第一次就兩邊都成功、變成沒有管理者。
    鎖與計數必須是兩個查詢：同一個 `SELECT ... FOR UPDATE` 等到鎖之後仍用舊快照的 `user_roles`。
  - 後端的搜尋測試原本把 `%20` 寫在 MockMvc 的網址樣板裡，會被再編碼成 `%2520`；改用 `.param()`。
  - E2E 一開始以整列文字判斷角色，被按鈕文字「設為管理者」誤判；改為只看角色欄。
  - 開發資料庫（先 `db:backup`）以新版啟動：會員搜尋正常，9 筆訂單中展示會員的 2 筆有 `user_id`，其餘是舊訂單。
- 2026-11-13：PR #3 的 CI 中，階段 3 的 E2E「在會員中心登出後回到首頁」失敗，停在 `/signin`（PR #2 時通過）。
  以真實瀏覽器把 CPU 降速 6 倍重現：10 次有 9 次被導向登入頁。原因是 React Router 的導向是低優先的 transition，
  「先導向首頁再登出」在裝置較慢時，登出清除 user 的更新先到，頁面在離開前就把它當成未登入。
  改為 `authSlice` 記下登出時所在的頁面（`signedOutFrom`，在登出開始時寫入），會員中心與填寫資料頁看到是自己時回首頁，卸載時才清除；
  修正後 6 倍與 20 倍降速各 10 次都回到首頁。jsdom 的 `MemoryRouter` 重現不了原本的問題，但能抓到修正過程中「清除標記太早」的錯誤。
  - 驗證時發現手動清除 E2E 環境沒帶 `DB_VOLUME`，compose 把 volume 解析成開發用的 `backend_postgres-data`（使用中所以沒被刪），E2E 的資料庫則留了下來。之後只用 `npm run e2e` 或帶齊 `scripts/e2e.sh` 的環境變數。
- 2026-11-13：PR #3 merge。與使用者討論第三方登入撞 email 的三種情境，改為「不自動合併、登入後連結」。開始階段 5，建立 `feature/google-signin` 分支。
- 2026-11-13：階段 5 在本機完成。後端 194 個測試、前端 168 個測試、E2E 10 個全部通過。
  - Google 文件確認：以 `sub` 辨識、email 只用來找既有帳號；只用 JavaScript callback 時不需要 redirect URI；以 http://localhost 測試要加 `http://localhost` 與含連接埠的來源，並設定 `Referrer-Policy: no-referrer-when-downgrade`。
  - client ID 改由後端的 `GET /api/user/google/config` 提供，前端不需要在建置時帶入，兩邊不會設定不一致。
  - 變更密碼的 `password` 改由 service 依帳號檢查（沒有密碼的帳號改帶 `credential`），所以兩個欄位都空白時只回報 `new_password`。
  - GIS 的 callback 是全域的（以最後一次 `initialize` 為準），所以一個畫面只放一個 Google 按鈕；會員中心依帳號狀態，連結按鈕與設定密碼的按鈕不會同時出現。
  - E2E 其他頁面載入了真的 GIS，它的「使用 Google 帳戶登入」按鈕讓舊測試的 `name: "登入"` 比對到兩個按鈕；改為 `exact: true`。
  - 在開發資料庫（先 `db:backup`）以新版啟動：`password_hash` 的 `NOT NULL` 已移除、`user_identities` 與兩個唯一限制建立；`GOOGLE_CLIENT_ID` 未設定時 `enabled: false`；nginx 回應帶 `Referrer-Policy`。
  - 真的 Google 帳號尚未測試：要由使用者依 `docs/README.md` 的「Google 登入設定」建立 client ID 後手動確認。
- 2026-11-13：使用者以真的 Google 帳號測試：Google 註冊 → 設定密碼（Percy Ku）、密碼註冊 → 連結不同的 Gmail（Ku Chao 連結 jod963852）都正常。
  接著用已被 Ku Chao 連結的 jod963852 以密碼註冊也成功了（Ku Chao Chun），造成同一個 Gmail 用 Google 登入與用密碼登入進到不同帳號。
  經使用者同意：先 `db:backup`，刪除 Ku Chao Chun（只有 users 與 user_roles 各一筆，沒有購物車、訂單、連結）；並追加規則：已被連結的 Google email 不能註冊或以 Google 建立新帳號。
  反向驗證：拿掉 `identityRepository.existsByEmail` 時新測試失敗。
- 2026-11-13：PR #4 merge，會員系統五個階段全部完成，計畫移到 `docs/plans/archive/`。之後加 GitHub、Facebook 登入時沿用 `user_identities` 與「email 相同不自動合併」的規則。
