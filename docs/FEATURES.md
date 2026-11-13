# 功能清單

## 功能狀態總覽

| 功能 | 狀態 | 前端有串接 | 備註 |
|---|---|---|---|
| 管理者登入／驗證 | ✅ 完成 | ✓ | JWT；只接受有 `ADMIN` 的帳號 |
| 會員註冊 | ✅ 完成 | ✓ | 前台 `/signup`，註冊後直接登入 |
| 會員登入 | ✅ 完成 | ✓ | 前台 `/signin`，Header 顯示姓名（連到會員中心）與登出 |
| 角色（`USER`、`ADMIN`） | ✅ 完成 | ✓ | 可同時擁有；後台只讓 `ADMIN` 進入 |
| 登入次數限制 | ✅ 完成 | ✓ | 前台與後台登入共用計數，前端顯示後端的訊息 |
| 登出 | ✅ 完成 | ✓ | 前台 Header 與後台導覽列 |
| 預設 admin 帳號 | ✅ 完成 | ✓ | 啟動時建立，只有 `ADMIN` |
| 每人一台購物車、登入時合併 | ✅ 完成 | ✓ | 訪客以 `X-Cart-Id` 識別 |
| 結帳需要會員 | ✅ 完成 | ✓ | 需要 `USER`，訂單記錄下單的帳號 |
| 展示會員與訂單 | ✅ 完成 | | `npm run seed:demo`，只對本機 |
| 會員中心：基本資料 | ✅ 完成 | ✓ | 前台 `/member`，姓名、電話、地址，結帳時預先帶入 |
| 會員中心：變更密碼 | ✅ 完成 | ✓ | 其他裝置的 token 失效，目前的裝置換成新 token |
| 會員升級為管理者 | 🚧 規劃中 | | 階段 4 |
| Google 登入 | 🚧 規劃中 | | 階段 5 |
| 產品管理（Admin） | ✅ 完成 | ✓ | |
| 圖片上傳 | ✅ 完成 | ✓ | 存本機磁碟 |
| 文章管理（Admin） | ✅ 完成 | ✓ | |
| 訂單管理（Admin） | ✅ 完成 | ✓ | 前端未使用刪除 |
| 優惠券管理（Admin） | ✅ 完成 | ✓ | |
| 產品瀏覽（Front） | ✅ 完成 | ✓ | |
| 文章瀏覽（Front） | ✅ 完成 | ✓ | |
| 購物車 | ✅ 完成 | ✓ | 每個訪客與會員各一台 |
| 套用優惠券（Front） | ✅ 完成 | ✓ | 購物車頁輸入優惠碼 |
| 結帳 | ✅ 完成 | ✓ | 需要登入會員 |
| 付款 | ✅ 完成 | ✓ | 訂單成功頁付款，只標記狀態，未串接金流 |

## 共通規則

**回應格式。** 成功時含 `success: true`，失敗時一律是 `{ "success": false, "message": "..." }`，包含 401、403、404、405、JSON 解析失敗、檔案過大與 500。

**寫入格式。** 除了登入，寫入 API 的內容（包含註冊）都包在 `{ "data": { ... } }` 裡。少了 `data` 回 400 `data 屬性不得為空`。多傳的欄位（前端會傳 `id`、`num`）一律忽略。

**分頁。** 查詢參數 `page`，每頁 10 筆，新到舊排序。

```json
{
  "pagination": {
    "total_pages": 3,
    "current_page": 1,
    "has_pre": false,
    "has_next": true,
    "category": ""
  }
}
```

- `page` 缺少、不是數字或小於 1 時視為第 1 頁。
- `page` 超過末頁時回傳最後一頁，不是空陣列。
- 沒有資料時 `total_pages` 與 `current_page` 都是 0，與 Hexschool 實際回應相同（2026-11-04 對照確認）。
- 清單中每筆的 `num` 是它在整份清單中的名次，從 1 開始，不是固定編號。

**驗證訊息。** 必填欄位缺少時回 400，例如 `title 屬性不得為空`；多個欄位錯誤時以「、」串接。

**金額。** 都是整數，傳小數回 400 `資料格式不正確`。

## 認證

### 角色

Hexschool 沒有一般會員。帳號的角色存在 `user_roles`，可以同時擁有多個：

| 角色 | 取得方式 | 可以做的事 |
|---|---|---|
| `USER` | 註冊 | 前台登入、結帳 |
| `ADMIN` | 預設 admin；階段 4 起可由管理者升級 | 後台全部功能、`GET /api/orders` |

- 升級為管理者是**加上** `ADMIN`，不移除 `USER`，所以升級後仍可以結帳。
- 預設的 `admin@gmail.com` 只有 `ADMIN`，是純後台帳號。
- 會員與管理者用同一種 token。`/api/admin/**` 與 `GET /api/orders` 需要 `ADMIN`，只有 `USER` 時回 403 `無此權限`。
- 角色在每次請求時從資料庫讀取，變更後立即生效，不需要重新登入。

### 帳號欄位

- **email**：去掉前後空白並轉成小寫後保存，不能修改，大小寫不同視為同一個。主鍵是 UUID（`uid`），不是 email。
- **密碼**：8–64 個字元，只能用英數與半形符號（不含空白），至少一個英文字母與一個數字。限制為 ASCII 是因為 bcrypt 只處理前 72 bytes。
- **姓名**：去掉前後空白後 1–30 個字。

### 註冊 `POST /v2/api/user/signup`

公開。Body 為 `{ "data": { "email", "password", "name" } }`，建立 `USER` 角色的帳號，**成功時直接登入**，回應與登入相同，`message` 為 `註冊成功`。

| 情境 | 回應 |
|---|---|
| email 已存在（不分大小寫，含預設 admin） | 400 `此 Email 已註冊` |
| 欄位空白 | 400 `email 屬性不得為空`、`password 屬性不得為空`、`name 屬性不得為空`，多個時排序後以「、」串接 |
| email 格式錯誤 | 400 `email 格式不正確` |
| 密碼不符規則 | 400 `密碼需為 8–64 個英數或半形符號，且至少包含一個英文字母與一個數字` |
| 姓名超過 30 個字 | 400 `name 不得超過 30 個字` |
| 沒有 `data` | 400 `data 屬性不得為空` |

註冊會透露 email 是否已註冊，這是一般網站的做法；註冊目前沒有次數限制，見 [ARCHITECTURE.md](ARCHITECTURE.md) 的已知限制。

前台 `/signup` 在送出前以相同規則檢查，另外要求輸入兩次相同的密碼（只在前端比對）。

### 會員登入 `POST /v2/api/user/signin`

公開。前台 `/signin` 使用，**任何角色都可以登入**。Body、回應與錯誤都和後台登入相同（沒有 403），也共用登入次數限制。

Header 在手機寬度（小於 md）只顯示一個會員連結，否則購物車會被擠到第二行：訪客只有「登入」（登入頁有註冊連結）；登入後只有會員中心的圖示，「後台」與「登出」從 md 起才顯示，手機在會員中心頁登出。

從其他頁面點 Header 的「登入」或「註冊」時，完成後回到原本的頁面；直接開啟時回到首頁。已登入時開啟 `/signin`、`/signup` 會直接離開。

### 後台登入 `POST /v2/admin/signin`

Body 為 `{ "username": "...", "password": "..." }`，不包 `data`。`username` 不分大小寫。

成功回傳 `{ success, message, uid, token, expired }`。`uid` 是帳號的 UUID；`expired` 是**毫秒**時間戳，前端直接用來設定 cookie 期限。token 有效期預設 7 天，由 `app.jwt.ttl` 設定。

| 情境 | 回應 |
|---|---|
| 帳號不存在或密碼錯誤 | 400 `登入失敗`，不透露是哪一項錯誤 |
| 欄位空白 | 400 `username 屬性不得為空` 等 |
| 密碼正確但沒有 `ADMIN` | 403 `此帳號沒有後台權限`，不計入失敗次數 |
| 失敗次數過多 | 429 `登入失敗次數過多，請 N 分鐘後再試`，附 `Retry-After`（**秒**） |

### 登入次數限制

Hexschool 沒有這項。以下兩種計數同時生效，任一種達到上限就鎖 15 分鐘：

| 計數 | 上限 | 登入成功時 |
|---|---|---|
| 同一 IP + 同一帳號 | 15 分鐘內失敗 5 次 | 歸零 |
| 同一 IP，不分帳號 | 15 分鐘內失敗 20 次 | 不歸零，避免穿插一次成功登入來重設 |

- 鎖定期間**密碼正確也回 429**，否則暴力破解仍可繼續。
- 一定帶上 IP，攻擊者無法從別的 IP 故意輸錯，把 admin 鎖在外面。
- 鎖定期間的請求不計入，不會延長鎖定；欄位空白的 400 與後台登入沒有權限的 403 也不計入。
- 前台（`/api/user/signin`）與後台（`/admin/signin`）登入**共用同一組計數**，不能換一支 API 繼續猜密碼。
- 帳號比對不分大小寫，並去除前後空白。
- 訊息中的分鐘數無條件進位；`Retry-After` 是剩餘秒數，至少 1。
- 參數在 `app.login-limit.*`（`max-failures-per-account`、`max-failures-per-ip`、`window`、`lockout`）。
- 計數存在記憶體，重啟後歸零。IP 取自 `request.getRemoteAddr()`，放在反向代理後面時見 [README.md](README.md) 的部署說明；docker compose 已設定。

前台與後台的登入頁都顯示後端回傳的訊息，429 時會看到 `登入失敗次數過多，請 15 分鐘後再試`。

### 驗證 `POST /v2/api/user/check`

任何角色的 token 都可以使用。帶有效 token 回 `{ success: true, uid, email, name, roles }`，否則回 401 `驗證錯誤, 請重新登入`。Hexschool 只回 `uid`，其他欄位是本專案加的。

`Authorization` 接受裸 token 與 `Bearer <token>` 兩種格式。

前端用它判斷登入狀態：

- 前台 Header 在載入時呼叫，顯示姓名與「登出」；`roles` 含 `ADMIN` 時多一個「後台」連結。沒有 token 時不呼叫。
- 後台路由（`ProductedRoute`）要求 `roles` 含 `ADMIN`，否則導向後台登入頁。一般會員的 token 不會被清除，回前台仍是登入狀態。
- 後台登入頁只在 token 有 `ADMIN` 時自動進入後台；一般會員的 token 會顯示 `目前登入的帳號沒有後台權限，請改用管理者帳號登入`。
- 401 時清除 cookie；網路錯誤時保留，下次再確認。

### 登出 `POST /v2/logout`

帶有效 token 時遞增該帳號的 `token_version`，**該帳號所有既有 token 立即失效**（包含其他裝置）。沒帶 token 或 token 無效也回 200，方便重複呼叫。

前台 Header 的「登出」留在原頁並顯示 `已登出`，但在需要登入的頁面（會員中心、填寫資料頁）會先回到首頁，否則頁面會把主動登出當成未登入而導向登入頁；會員中心頁的「登出」同樣回到首頁。後台導覽列的「登出」導向後台登入頁。網路錯誤時兩者都仍清除本機的 token。

### 會員資料 `GET`、`PUT ~/user/profile`

需要登入，**任何角色都可以**（預設 admin 也可以）。身分由 token 決定，網址不帶 id。Hexschool 沒有這組。

讀取回 `{ success, profile: { email, name, tel, address } }`，`tel`、`address` 未填時是空字串。

更新的 Body 為 `{ "data": { "name", "tel", "address" } }`，**整筆取代**：`tel` 或 `address` 沒帶或空字串時清除。`email` 不能修改，body 帶了也忽略。成功回 `已更新會員資料` 與更新後的 `profile`；`name` 改了之後 `/user/check` 也是新的姓名。

| 欄位 | 規則（去掉前後空白後） | 錯誤 |
|---|---|---|
| `name` | 1–30 個字，與註冊相同 | 400 `name 屬性不得為空`、`name 不得超過 30 個字` |
| `tel` | 空字串，或 8–20 個半形數字（不接受 `-`、`+`、空白、全形數字），與結帳表單一致 | 400 `tel 需為 8–20 個數字` |
| `address` | 最多 100 個字 | 400 `address 不得超過 100 個字` |

多個欄位錯誤時排序後以「、」串接。沒有 token 回 401。

前台 `/member`（會員中心）的「基本資料」卡片使用：email 唯讀，送出前以相同規則檢查，儲存後 Header 的姓名跟著更新。
結帳的填寫資料頁以帳號的姓名、email 與這裡的電話、地址預先填入收件資料，已經輸入的不覆蓋；讀不到會員資料時只帶入姓名與 email，不影響結帳。

### 變更密碼 `PUT ~/user/password`

需要登入，任何角色。Body 為 `{ "data": { "password", "new_password" } }`，`password` 是目前的密碼。Hexschool 沒有這支。

成功時遞增 `token_version`，**該帳號所有既有 token 失效**（其他裝置要重新登入），回應與登入相同（`message` 為 `已變更密碼`），帶新的 token 讓目前的裝置維持登入。

| 情境 | 回應 |
|---|---|
| 欄位空白 | 400 `new_password 屬性不得為空`、`password 屬性不得為空` |
| 新密碼不符規則（與註冊相同） | 400 `密碼需為 8–64 個英數或半形符號，且至少包含一個英文字母與一個數字` |
| 目前的密碼錯誤 | 400 `目前的密碼不正確`，**計入登入失敗次數** |
| 新密碼與目前相同 | 400 `新密碼不能與目前的密碼相同` |
| 失敗次數過多 | 429 `登入失敗次數過多，請 N 分鐘後再試`，附 `Retry-After` |

目前的密碼錯誤與登入共用同一組計數（IP + 帳號 email、IP 總量），否則拿到 token 的人可以用這支猜密碼。鎖定時連登入也被擋，反之亦然。

前台會員中心的「變更密碼」卡片要求輸入兩次新密碼（只在前端比對），成功後以新的 token 取代 cookie 中的舊 token，並提示 `已變更密碼，其他裝置需要重新登入`。

### 預設 admin

`AdminSeeder` 在每次啟動時檢查 `app.admin.email` 是否存在，不存在才建立，角色只有 `ADMIN`、姓名為 `管理者`。帳號已存在時不會變動，所以修改 `ADMIN_PASSWORD` 不會更新既有帳號的密碼。

## 產品

### Admin

- `GET ~/admin/products`：查詢參數 `page`、`category`。包含未上架產品，`products` 是陣列。
- `GET ~/admin/products/all`：不分頁，`products` 是以 id 為 key 的物件，舊到新。
- `POST ~/admin/product`：回傳 `已建立產品`。
- `PUT ~/admin/product/{id}`：整筆覆寫，回傳 `已更新產品`。
- `DELETE ~/admin/product/{id}`：同時移除購物車內的該產品。歷史訂單有快照，不受影響。

欄位：`title`、`category`、`unit`、`origin_price`、`price` 必填；`is_enabled` 只接受 0 或 1，未傳視為 0；`imagesUrl` 必須是陣列，未傳視為空陣列。

| 情境 | 回應 |
|---|---|
| 必填欄位缺少 | 400 `title 屬性不得為空` 等 |
| 價格小於 0 | 400 `price 不得小於 0` |
| 更新時 id 不存在 | 404 `id 不存在` |
| 刪除時 id 不存在 | 404 `找不到產品` |

### Front

只回傳 `is_enabled = 1` 的產品。

- `GET ~/products`：查詢參數 `page`、`category`。`category` 未傳時前端用 `all` 代表全部，但實際不會送出。查詢的分類會出現在 `pagination.category`。
- `GET ~/products/all`：不分頁，舊到新，不含 `num`。前端用來計算分類清單與搜尋。
- `GET ~/product/{id}`：不存在或已下架都回 404 `找不到產品`。

## 圖片上傳 `POST ~/admin/upload`

`multipart/form-data`，欄位名稱是 `file-to-upload`。成功回傳 `{ success: true, imageUrl }`。

檢查規則：

- 副檔名必須是 jpg、jpeg 或 png，不分大小寫。
- 檔案開頭的 magic bytes 必須與副檔名相符，改副檔名的檔案會被拒絕。
- 大小不得超過 3MB。
- 存檔時以 UUID 重新命名，不使用原始檔名。

| 情境 | 回應 |
|---|---|
| 格式不符、空檔案、欄位名稱錯誤 | 400 `檔案格式錯誤` |
| 超過 3MB | 400 `檔案大小不得超過 3MB` |

`imageUrl` 開頭由 `app.public-base-url` 決定。部署時要設成對外網址，否則前端拿到的是 localhost 網址。

## 文章

### Admin

- `GET ~/admin/articles`：查詢參數 `page`，排序依 `create_at` 新到舊，**包含 `content`**（Hexschool 不含，原因見 [ARCHITECTURE.md](ARCHITECTURE.md)）。
- `GET ~/admin/article/{id}`：不存在回 404 `找不到文章`。
- `POST ~/admin/article`、`PUT ~/admin/article/{id}`：回傳 `已建立文章`、`已更新文章`。
- `DELETE ~/admin/article/{id}`：不存在回 404 `找不到文章`。
- 新增與更新時 `tag` 未傳或為空陣列，回 400 `tag 至少選擇一個`。既有沒有分類的文章仍可讀取，但下次更新時必須補上。

欄位：`title`、`description`、`author`、`content` 必填；`tag` 必填且至少一個；`image`、`isPublic` 選填。

`description` 是**摘要**，顯示在首頁的文章卡片；`content` 是**內文**，顯示在文章頁。內文是純文字，前端以 `white-space: pre-line` 保留換行，不當作 HTML 解析。

`create_at` 原值保存，**不換算單位**。前端傳 `Date.now()`（毫秒）並以 `new Date(create_at)` 顯示。新增時未傳則用目前毫秒，更新時未傳則保留原值。

### Front

只回傳 `isPublic = true` 的文章。

- `GET ~/articles`：清單**不含 `content`**。
- `GET ~/article/{id}`：回傳 `{ success, article }`，含 `content`。不存在或未公開回 404 `找不到文章`。

## 購物車

### 誰的購物車

每個訪客與每個帳號各一台（Hexschool 是全站共用一台）。購物車與優惠券的 API 都依呼叫者決定是哪一台：

| 請求 | 購物車 |
|---|---|
| 帶有效 token | 該帳號的購物車，忽略 `X-Cart-Id` |
| 沒有 token，帶 `X-Cart-Id` | 該訪客的購物車，第一次加入商品時建立 |
| 都沒有 | 視為空的；讀取、清空、移除優惠券都成功，加入商品回 400 `缺少 X-Cart-Id` |

- `X-Cart-Id` 是前端產生的 UUID（v4），存在 localStorage 的 `freetrav-cart-id`，每個瀏覽器一個。不分大小寫。沒有 token 且格式錯誤時回 400 `X-Cart-Id 格式不正確`。
- localStorage 無法使用（例如封鎖網站資料）時改存在記憶體，重新整理後是新的購物車。
- 修改或刪除不在自己購物車的品項回 404 `找不到購物車品項`，不透露品項是否存在。
- 只有 `ADMIN` 的帳號也有自己的購物車，但不能結帳。

### 合併 `POST ~/cart/merge`

需要登入。前台在會員**登入或註冊成功後**呼叫，把這個瀏覽器的訪客購物車（`X-Cart-Id`）併入帳號的購物車，回應與 `GET ~/cart` 相同。

- 同一個產品：數量相加，超過 9999 時以 9999 計；優惠券以帳號購物車原本的為準。
- 帳號購物車沒有的產品：整列移過去，保留原本套用的優惠券。
- 合併後刪除訪客購物車，所以**登出後**看到的是空的訪客購物車；帳號的購物車留在伺服器，下次登入還在。
- 沒帶 `X-Cart-Id`、訪客購物車不存在或是空的，直接回傳帳號的購物車；重複呼叫不會重複合併。
- 合併失敗（例如網路錯誤）不影響登入，訪客購物車留在原處。

| 情境 | 回應 |
|---|---|
| 沒有 token | 401 `驗證錯誤, 請重新登入` |
| `X-Cart-Id` 格式錯誤 | 400 `X-Cart-Id 格式不正確` |

### 品項

- `GET ~/cart`：回傳 `{ success, data: { carts, total, final_total }, messages: [] }`。
- `POST ~/cart`：Body 的 `data` 含 `product_id`、`qty`。同一產品重複加入時**累加數量**，因為前端以 `product.id` 當 React key，每個產品只能有一列。回傳的 `data.product.title` 用於前端提示訊息。
- `PUT ~/cart/{id}`：直接設定數量，回傳 `{ data: { product_id, qty } }`。
- `DELETE ~/cart/{id}`：刪除單一品項。
- `DELETE ~/carts`：清空。

`total` 是原價小計，`final_total` 是折扣後小計，都依**目前售價**即時計算，所以改價後購物車金額會跟著變。

| 情境 | 回應 |
|---|---|
| 產品不存在 | 404 `找不到產品` |
| 產品已下架 | 400 `產品已下架` |
| `qty` 小於 1 | 400 `qty 不得小於 1` |
| `qty` 或累加後超過 9999 | 400 `qty 不得大於 9999` |
| 品項不存在，或不在呼叫者的購物車 | 404 `找不到購物車品項` |
| `PUT` 的 `product_id` 與品項不符 | 400 `product_id 與購物車品項不符` |
| 沒有 token 也沒有 `X-Cart-Id` 時加入商品 | 400 `缺少 X-Cart-Id` |
| 沒有 token，`X-Cart-Id` 格式錯誤 | 400 `X-Cart-Id 格式不正確` |

## 優惠券

### Admin

- `GET ~/admin/coupons`：查詢參數 `page`。
- `POST ~/admin/coupon`、`PUT ~/admin/coupon/{id}`：回傳 `已建立優惠券`、`已更新優惠券`。
- `DELETE ~/admin/coupon/{id}`：同時清除購物車對它的引用，購物車回到原價。歷史訂單有快照，不受影響。

欄位：`title`、`code`、`percent`、`due_date` 必填。`percent` 是**實付比例**，80 代表付 80%。`due_date` 是 Unix **秒**。

| 情境 | 回應 |
|---|---|
| `code` 重複 | 400 `code 已存在` |
| `percent` 不在 0–100 | 400 `percent 必須介於 0 到 100` |
| 更新時 id 不存在 | 404 `id 不存在` |
| 刪除時 id 不存在 | 404 `找不到優惠券` |

### 套用 `POST ~/coupon`

Body 的 `data` 含 `code`，成功回傳 `已套用優惠券:<code>` 與 `data.final_total`。

- 只套用在**目前購物車內**的品項，之後才加入的品項不帶優惠（與 Hexschool 相同）。
- 每個品項的 `final_total = round(total × percent ÷ 100)`，四捨五入到整數。購物車總額是各品項相加。
- 套用新的優惠券會取代舊的。
- 優惠券只在**啟用且未過期**時有效，購物車顯示與結帳計算用同一套規則：
  - 套用後被停用或過期：購物車立即不再折扣，品項也不出現 `coupon`。品項上的引用保留，重新啟用後折扣恢復。
  - 套用後被刪除：從購物車移除，回到售價。

| 情境 | 回應 |
|---|---|
| 找不到或已停用 | 404 `找不到優惠券` |
| 已過期 | 400 `優惠券已過期` |
| 購物車是空的 | 400 `購物車無資料` |

### 移除 `DELETE ~/coupon`

清除購物車所有品項的優惠券，回傳 `已移除優惠券` 與 `data.final_total`。購物車沒有套用或是空的，同樣回 200。Hexschool 沒有這支 API。

## 訂單

### 建立 `POST ~/order`

**需要 `USER` 角色**（Hexschool 是公開的）。結帳的是帳號的購物車，訂單的 `user_id` 記錄下單的帳號。
`user` 是收件資料，可以與帳號的姓名、email 不同，所以不能用它判斷訂單屬於誰。
會員系統之前的訂單 `user_id` 是 null，不以 email 對應到會員。

前台的「前往結賬」在未登入時導向 `/signin`（提示 `請先登入會員再結帳`），登入後回到填寫資料頁，並以帳號的姓名、email 與會員中心的電話、地址預先填入收件資料（見會員資料）。只有 `ADMIN` 的帳號會看到 `此帳號不能結帳，請改用會員帳號登入`，無法送出。

Body 的 `data` 含 `user`（`name`、`email`、`tel`、`address` 皆必填）與選填的 `message`、`final_total`。

**金額比對。** `final_total` 是前端畫面顯示的總計。後台刪除或停用優惠券、優惠券過期、商品改價，都會讓購物車金額在顧客填資料時改變。帶了 `final_total` 且與後端計算不同時回 409，不建立訂單、不清空購物車；前端重新讀取購物車，讓顧客看過新金額再送出。沒帶則不比對。前端一律會帶，進入填寫資料頁時也會重新讀取購物車。

在單一交易內建立訂單、寫入品項快照並清空**帳號的**購物車（同一個瀏覽器的訪客購物車不受影響）。成功回傳 `{ success, message, total, create_at, orderId }`。`total` 是**折扣後總額**，`create_at` 是 Unix **秒**。

| 情境 | 回應 |
|---|---|
| 沒有 token | 401 `驗證錯誤, 請重新登入` |
| 帳號沒有 `USER`（例如預設 admin） | 403 `無此權限` |
| 購物車是空的 | 400 `購物車無資料` |
| 購物車含已下架產品 | 400 `購物車內有已下架產品` |
| 缺少 `user` | 400 `user 屬性不得為空` |
| Email 格式錯誤 | 400 `email 格式不正確` |
| `final_total` 與購物車金額不同 | 409 `訂單金額已變動，請重新確認` |

### 查詢

- `GET ~/order/{id}`：公開。找不到時回 **200** `{ success: true, order: null }`，與 Hexschool 相同。
- `GET ~/orders`、`GET ~/admin/orders`：需要 admin，查詢參數 `page`。

訂單的 `products` 是**以品項 id 為 key 的物件**，前端用 `Object.values` 讀取。未付款時回應不含 `paid_date`。

### 付款 `POST ~/pay/{id}`

設定 `is_paid = true` 與 `paid_date`（Unix **秒**），只標記狀態，沒有串接金流。

| 情境 | 回應 |
|---|---|
| 訂單不存在 | 404 `找不到訂單` |
| 已付款 | 400 `訂單已付款` |

### Admin 更新 `PUT ~/admin/order/{id}`

前端會把整筆訂單傳回來，但**只有 `is_paid` 與 `status` 會生效**，其餘欄位忽略，避免竄改金額或品項。

- `status` 來自 `<select>`，是字串（`"2"`），會自動轉成整數。必須是 0–3。
- `is_paid` 由 false 改為 true 時，伺服器寫入 `paid_date`；改回 false 時清除。已付款的訂單重複送 true 不會改變付款時間。

| 情境 | 回應 |
|---|---|
| 訂單不存在 | 404 `找不到訂單` |
| `status` 超出範圍 | 400 `status 必須介於 0 到 3` |

### Admin 刪除

- `DELETE ~/admin/order/{id}`：不存在回 404 `找不到訂單`。
- `DELETE ~/admin/orders/all`：刪除全部訂單。
