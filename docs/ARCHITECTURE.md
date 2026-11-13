# 架構

## 系統概觀

```
瀏覽器（React，HashRouter）
   │  axios：Authorization 為裸 token，不帶 cookie
   ▼
Spring Boot（context-path /v2）
   │  CORS → JwtAuthenticationFilter → 授權規則 → Controller → Service → Repository
   ▼
PostgreSQL            本機 uploads/ 目錄（由 /v2/uploads/** 提供）
```

以 docker compose 執行時，瀏覽器先連到 nginx：靜態檔由 nginx 提供，`/v2` 轉給後端，前後端同源。見 [README.md](README.md#docker)。

後端採 controller → service → repository 分層，基礎套件為 `com.percyku.backend`：

| 套件 | 職責 |
|---|---|
| `config` | `SecurityConfig`（授權規則、CORS）、`AppProperties`（`app.*` 設定）、`WebConfig`（圖片靜態資源）、`AdminSeeder`、`ProductionConfigCheck`（prod profile 的密鑰檢查） |
| `security` | `JwtService`、`JwtAuthenticationFilter`、`JsonSecurityErrorHandler`（JSON 格式的 401/403）、`LoginAttemptLimiter`（登入次數限制） |
| `entity` | JPA entity，由 `apply(request)` 接收輸入 |
| `repository` | Spring Data JPA |
| `dto` | request/response record，`ApiResponses`（回應外層）、`PagedResult`（分頁） |
| `service` | 業務邏輯與交易邊界 |
| `controller` | `Admin*` 對應 `/admin` 路由，`Front*` 對應公開路由，`AuthController` 處理認證 |
| `exception` | `ApiException`、`TooManyRequestsException`（429，附 `Retry-After`）、`GlobalExceptionHandler` |

## 相容性原則

規格有三個來源：[Swagger 文件](https://hexschool.github.io/ec-courses-api-swaggerDoc/#/)、前端原始碼、真實 API 的回應。三者衝突時，優先順序是：

**前端實際讀取的欄位 > 真實 API 行為 > Swagger。**

Swagger 有數處與實際不符，修改回應格式前請先確認前端怎麼讀，不要只看 Swagger：

| 項目 | Swagger | 採用的行為 |
|---|---|---|
| `GET /products` 的 `products` | 物件 map | 陣列 |
| `GET /article/{id}` | `articles` + `pagination` | `{ success, article }` |
| 未帶或無效 token | 403 | 401，`驗證錯誤, 請重新登入` |
| `POST /admin/signin` 成功 | `status: true` | `success: true` |
| `POST /admin/coupon`、`PUT /admin/coupon/{id}`、`PUT /admin/article/{id}` 的訊息 | 「已建立產品」等複製貼上的文字 | 依實際動作，例如「已建立優惠券」 |
| 訂單 `status` | 無此欄位 | 0–3，前端有使用 |

### 與 Hexschool 的刻意差異

| 項目 | Hexschool | 本專案 | 原因 |
|---|---|---|---|
| `GET /orders` | 公開 | 需要 admin token | 回應含全部訂單的姓名、Email、電話、地址；現有前端沒有使用 |
| Admin 文章清單 | 不含 `content` | 含 `content` | 前端編輯時直接用清單資料帶入內容，少了會被覆寫成 `"default"` |
| 路徑中的 `api_path` | `/v2/api/{api_path}/...`，需向 Hexschool 申請 | 移除，`/v2/api/...` | 本專案有自己的後端，不需要區分申請者；舊路徑回 404 |
| `POST /logout` | — | 遞增 `token_version`，該帳號既有 token 全部失效 | JWT 無狀態，需要版本號才能真正登出 |
| `paid_date` | 由傳入資料決定 | 由伺服器在付款狀態變更時決定 | 否則後台勾選已付款後，列表會同時顯示「付款完成」與「未付款」 |
| `POST /admin/signin` | 無次數限制 | 失敗過多回 429 | 防止暴力破解，規則見 [FEATURES.md](FEATURES.md) |
| 會員 | 無（只有申請者的 admin 帳號） | 註冊、前台登入，角色 `USER`／`ADMIN` 可同時擁有 | 會員系統，見 [FEATURES.md](FEATURES.md) 的認證 |
| `POST /admin/signin` 的權限 | 帳號都是 admin | 沒有 `ADMIN` 回 403 `此帳號沒有後台權限` | 一般會員不能登入後台 |
| `POST /api/user/check` | `{ success, uid }` | 多回 `email`、`name`、`roles` | 前端依 `roles` 判斷能否進入後台 |
| 購物車 | 全站共用一台 | 每個訪客（`X-Cart-Id`）與帳號各一台，登入時 `POST /cart/merge` 合併 | 不同訪客不會看到、清空彼此的購物車 |
| `POST /order` | 公開 | 需要 `USER`，訂單記錄 `user_id` | 會員才能結帳，訂單能對應到帳號 |
| 已套用的優惠券 | 只在套用時檢查到期日，之後停用或過期仍有折扣 | 停用或過期立即不再折扣 | 停用要能立即生效 |
| `POST /order` | 無金額比對 | 選填 `final_total`，與購物車金額不同回 409 | 避免顧客在不知情下以另一個金額成交 |
| `DELETE /coupon` | 無 | 移除已套用的優惠券 | 顧客可以取消優惠 |

## 路由表

### 頁面路由

前端使用 HashRouter，實際網址為 `/#/product` 這類形式。

| 路徑 | 元件 | 權限 | 說明 |
|---|---|---|---|
| `/` | `Home` | 公開 | 首頁，含文章列表 |
| `/product` | `Product` | 公開 | 產品列表，可依分類篩選 |
| `/product/:id` | `SingleProduct` | 公開 | 單一產品 |
| `/searchproduct/:search` | `SearchProduct` | 公開 | 依標題或分類搜尋 |
| `/article/:id` | `SingleArticle` | 公開 | 單篇文章 |
| `/cartcheckout` | `CartCheckout` | 公開 | 購物車，可套用優惠碼 |
| `/cartform` | `CartForm` | 公開 | 填寫訂購資料 |
| `/cartsuccess/:orderId` | `CartSuccess` | 公開 | 訂購完成，可付款 |
| `/signin` | `MemberSignin` | 公開 | 會員登入，完成後回到來源頁 |
| `/signup` | `MemberSignup` | 公開 | 會員註冊，完成後是登入狀態 |
| `/member` | `MemberCenter` | 需登入 | 會員中心：基本資料、變更密碼、登出。未登入導向 `/signin`，登入後回來 |
| `/login` | `Login` | 公開 | 後台登入，只接受 `ADMIN` |
| `/admin/products` | `AdminProducts` | `ADMIN` | 產品管理 |
| `/admin/orders` | `AdminOrders` | `ADMIN` | 訂單管理 |
| `/admin/articles` | `AdminArticle` | `ADMIN` | 文章管理 |
| `/admin/coupons` | `AdminCoupons` | `ADMIN` | 優惠券管理 |
| `/admin/users` | `AdminUsers` | `ADMIN` | 會員列表、設定與移除管理者 |

### REST API

路徑皆含 context-path `/v2`。下表的 `~` 代表 `/v2/api`。Hexschool 的路徑中間還有一段 `api_path`（例如 `react-week2-api`），本專案已移除。

權限欄的 **Admin** 表示 token 的帳號要有 `ADMIN` 角色，只有 `USER` 時回 403；**USER** 表示要有 `USER` 角色；**需登入**表示任何角色都可以。購物車與優惠券的 API 是公開的，但依呼叫者區分購物車，見 [FEATURES.md](FEATURES.md) 的購物車。詳細行為見 [FEATURES.md](FEATURES.md)。

| 方法 | 路徑 | 權限 | 前端有用 | 說明 |
|---|---|---|---|---|
| POST | `/v2/admin/signin` | 公開 | ✓ | 後台登入，沒有 `ADMIN` 回 403 |
| POST | `~/user/signup` | 公開 | ✓ | 會員註冊，成功時直接登入（Hexschool 沒有） |
| POST | `~/user/signin` | 公開 | ✓ | 會員登入，任何角色（Hexschool 沒有） |
| POST | `/v2/logout` | 公開 | ✓ | 登出，帶有效 token 時撤銷 |
| POST | `/v2/api/user/check` | 需登入 | ✓ | 驗證 token，回傳角色 |
| GET | `~/user/profile` | 需登入 | ✓ | 會員資料（Hexschool 沒有） |
| PUT | `~/user/profile` | 需登入 | ✓ | 更新姓名、電話、地址（Hexschool 沒有） |
| PUT | `~/user/password` | 需登入 | ✓ | 變更密碼或第一次設定密碼（帶 Google credential），回傳新 token（Hexschool 沒有） |
| GET | `~/user/google/config` | 公開 | ✓ | Google 登入是否啟用與 client ID（Hexschool 沒有） |
| POST | `~/user/google` | 公開 | ✓ | Google 登入或註冊，email 已有帳號時 409（Hexschool 沒有） |
| POST | `~/user/google/link` | 需登入 | ✓ | 連結 Google（Hexschool 沒有） |
| DELETE | `~/user/google/link` | 需登入 | ✓ | 解除連結 Google，至少保留一種登入方式（Hexschool 沒有） |
| GET | `~/admin/products` | Admin | ✓ | 產品分頁 |
| GET | `~/admin/products/all` | Admin | | 全部產品，以 id 為 key |
| POST | `~/admin/product` | Admin | ✓ | 新增產品 |
| PUT | `~/admin/product/{id}` | Admin | ✓ | 更新產品 |
| DELETE | `~/admin/product/{id}` | Admin | ✓ | 刪除產品 |
| POST | `~/admin/upload` | Admin | ✓ | 上傳圖片 |
| GET | `~/admin/orders` | Admin | ✓ | 訂單分頁，含 `user_id` |
| PUT | `~/admin/order/{id}` | Admin | ✓ | 更新付款與外送狀態，自己的訂單 403 |
| DELETE | `~/admin/order/{id}` | Admin | | 刪除訂單，自己的訂單 403 |
| DELETE | `~/admin/orders/all` | Admin | | 刪除全部訂單，含自己的訂單時 403 |
| GET | `~/admin/users` | Admin | ✓ | 會員分頁，`q` 搜尋（Hexschool 沒有） |
| PUT | `~/admin/user/{id}` | Admin | ✓ | 設定或移除管理者（Hexschool 沒有） |
| GET | `~/admin/coupons` | Admin | ✓ | 優惠券分頁 |
| POST | `~/admin/coupon` | Admin | ✓ | 新增優惠券 |
| PUT | `~/admin/coupon/{id}` | Admin | ✓ | 更新優惠券 |
| DELETE | `~/admin/coupon/{id}` | Admin | ✓ | 刪除優惠券 |
| GET | `~/admin/articles` | Admin | ✓ | 文章分頁 |
| GET | `~/admin/article/{id}` | Admin | | 單篇文章 |
| POST | `~/admin/article` | Admin | ✓ | 新增文章 |
| PUT | `~/admin/article/{id}` | Admin | ✓ | 更新文章 |
| DELETE | `~/admin/article/{id}` | Admin | ✓ | 刪除文章 |
| GET | `~/products` | 公開 | ✓ | 上架產品分頁 |
| GET | `~/products/all` | 公開 | ✓ | 全部上架產品 |
| GET | `~/product/{id}` | 公開 | ✓ | 單一上架產品 |
| GET | `~/cart` | 公開 | ✓ | 取得購物車（依 token 或 `X-Cart-Id`） |
| POST | `~/cart` | 公開 | ✓ | 加入購物車 |
| PUT | `~/cart/{id}` | 公開 | ✓ | 更新數量 |
| DELETE | `~/cart/{id}` | 公開 | ✓ | 刪除單一品項 |
| DELETE | `~/carts` | 公開 | ✓ | 清空購物車 |
| POST | `~/cart/merge` | 需登入 | ✓ | 登入後合併訪客購物車（Hexschool 沒有） |
| POST | `~/coupon` | 公開 | ✓ | 套用優惠券 |
| DELETE | `~/coupon` | 公開 | ✓ | 移除已套用的優惠券（Hexschool 沒有） |
| POST | `~/order` | **USER** | ✓ | 建立訂單（與 Hexschool 不同） |
| GET | `~/orders` | **Admin** | | 訂單分頁，含 `user_id`（與 Hexschool 不同） |
| GET | `~/order/{id}` | 公開 | ✓ | 單筆訂單 |
| POST | `~/pay/{id}` | 公開 | ✓ | 付款 |
| GET | `~/articles` | 公開 | ✓ | 公開文章分頁 |
| GET | `~/article/{id}` | 公開 | ✓ | 單篇公開文章 |
| GET | `/v2/uploads/{file}` | 公開 | ✓ | 讀取上傳的圖片（靜態資源，不在 41 個 API 內） |

授權規則寫在 `SecurityConfig`，依序比對。未列入的路徑一律拒絕。

## DB Schema

主鍵皆為 Hibernate 產生的隨機 UUID 字串。前端把 id 當不透明字串；公開的 `GET /order/{id}` 也靠它不可猜測。

Schema 由 `spring.jpa.hibernate.ddl-auto=update` 維護，pom 沒有 Flyway。`update` 只會新增、不會改型別或刪欄位，變更既有欄位時要自行處理資料庫。需要手動處理的轉換都在 `LegacySchemaMigration`（見下方 `users` 與 `cart_lines`）。

### `users`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | JWT 的 subject、回應中的 `uid` |
| `email` | varchar UNIQUE | 登入帳號，小寫保存，不能修改 |
| `password_hash` | varchar，可為 null | BCrypt。只用 Google 登入的帳號沒有密碼。舊資料庫的 `NOT NULL` 由 `LegacySchemaMigration` 移除 |
| `name` | varchar(30) | 姓名。DDL 允許 null（`update` 無法對有資料的表加 `NOT NULL` 欄位），程式寫入時一定有值 |
| `tel` | varchar(20)，可為 null | 電話，未填時為 null（回應為空字串），結帳時預先帶入 |
| `address` | varchar(100)，可為 null | 地址，同上 |
| `token_version` | int | 簽進 JWT，登出與變更、設定密碼時遞增 |
| `created_at` | timestamp | |

### `user_identities`

帳號連結的第三方登入。`(provider, subject)` 唯一（一個 Google 帳號只能屬於一個會員），`(user_id, provider)` 唯一（一個會員只連結一個 Google 帳號）。之後的 GitHub、Facebook 也存在這裡。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `user_id` | FK → users | |
| `provider` | varchar(20) | 目前只有 `google` |
| `subject` | varchar | 平台的帳號 ID（Google 的 `sub`），以它辨識，不用 email |
| `email` | varchar，可為 null | 連結當時平台的 email，只用來顯示，可以與帳號的 email 不同 |
| `created_at` | timestamp | |

**舊資料庫的轉換。** 會員系統之前的 `users` 有單一的 `role` 欄位（`NOT NULL`）。`LegacySchemaMigration` 每次啟動時檢查，存在時把它複製到 `user_roles` 後移除，並以 email 的 `@` 前面補上沒有的姓名；轉換過就不做事。還原舊備份後重新啟動後端即可（`npm run db:restore` 會自動重新啟動）。

### `user_roles`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `user_id` | FK → users | |
| `role` | varchar(20) | `USER` 或 `ADMIN` |

主鍵為 `(user_id, role)`。每次驗證 token 都會一起讀取（`EAGER`），所以角色變更立即生效。

### `products`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `title`、`category`、`unit` | varchar | 必填 |
| `origin_price`、`price` | int | 必填，≥ 0，整數 |
| `description`、`content` | text | |
| `is_enabled` | boolean | API 上是 0/1 |
| `image_url` | text | 主圖 |
| `images_url` | jsonb | 副圖陣列 |
| `created_at` | timestamp | 排序用，不對外 |

### `coupons`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `title` | varchar | |
| `code` | varchar UNIQUE | 優惠碼 |
| `percent` | int | 實付比例，0–100，80 代表付 80% |
| `due_date` | bigint | 到期時間，Unix **秒** |
| `is_enabled` | boolean | API 上是 0/1 |
| `created_at` | timestamp | 排序用 |

### `articles`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `title`、`author` | varchar | 必填 |
| `description`、`content` | text | 必填 |
| `image` | text | |
| `tag` | jsonb | 字串陣列 |
| `create_at` | bigint | 由前端傳入，原值保存。現有前端傳**毫秒** |
| `is_public` | boolean | |

### `carts`

每個訪客與每個帳號各一台，`user_id` 與 `guest_id` 剛好一個有值。訪客購物車在第一次加入商品時建立，合併後刪除。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `user_id` | FK → users，UNIQUE，可為 null | 帳號的購物車 |
| `guest_id` | varchar(36) UNIQUE，可為 null | 訪客的 `X-Cart-Id`，小寫保存 |
| `created_at` | timestamp | |

### `cart_lines`

購物車的品項。金額不落地，讀取時由目前售價與優惠券算出。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `cart_id` | FK → carts | |
| `product_id` | FK → products | `(cart_id, product_id)` UNIQUE，每台購物車的每個產品最多一列 |
| `qty` | int | 1–9999 |
| `coupon_id` | FK → coupons，可為 null | |
| `created_at` | timestamp | 排序用 |

**舊的 `cart_items`。** 會員系統之前全站共用一台購物車，品項存在 `cart_items`，`product_id` 有單欄 UNIQUE。`ddl-auto=update` 無法移除這個限制，也無法對有資料的表加上 `NOT NULL` 的 `cart_id`，所以品項改存新的 `cart_lines`；`LegacySchemaMigration` 在啟動時移除 `cart_items`，裡面的品項沒有擁有者，直接捨棄。

### `orders`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `user_id` | FK → users，可為 null | 下單的帳號。會員系統之前的訂單是 null |
| `user_name`、`user_email`、`user_tel`、`user_address` | varchar | 收件資料，可以與帳號不同，不能用來判斷訂單屬於誰 |
| `message` | text | 留言 |
| `total` | bigint | 折扣後總額 |
| `is_paid` | boolean | |
| `paid_date` | bigint，可為 null | 付款時間，Unix **秒** |
| `status` | int | 0 未確認、1 已確認、2 外送中、3 已送達 |
| `create_at` | bigint | 建立時間，Unix **秒** |

### `order_items`

下單當下的快照。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | 也是回應中 `products` 的 key |
| `order_id` | FK → orders | |
| `product_id` | varchar(36) | **刻意不設外鍵**，產品可被刪除 |
| `qty` | int | |
| `total`、`final_total` | bigint | 原價小計、折扣後小計 |
| `product_snapshot` | jsonb | 下單時的產品資料 |
| `coupon_snapshot` | jsonb，可為 null | 下單時的優惠券資料 |
| `sort_order` | int | 維持購物車順序 |

## 資料流

### 登入與驗證

1. 前台 `MemberSignin`（`POST ~/user/signin`）、`MemberSignup`（`POST ~/user/signup`）或後台 `Login`（`POST /v2/admin/signin`）取得 token，由 `utils/auth.js` 把 `token` 與 `expired`（毫秒）寫入 cookie `freetrav-token`（名稱由 `VITE_APP_TOKEN_NAME` 設定）。**會員與管理者共用這個 cookie**，同一個瀏覽器一次只有一個帳號登入。
   Google 登入（`POST ~/user/google`）也一樣：前端以 GIS 取得 Google 的 ID token，後端以 `GoogleTokenVerifier` 驗證（Google 的 JWKS，依 Cache-Control 快取）後發我們自己的 JWT，之後與一般登入相同。
2. 前端把 cookie 的值設為 `axios.defaults.headers.common.Authorization`，所以 header 是**裸 token，沒有 `Bearer`**。Filter 兩種格式都接受。
3. `authSlice` 的 `checkAuth` 呼叫 `POST /v2/api/user/check`，把 `{ uid, email, name, roles }` 存進 Redux：前台 `Header` 在載入時呼叫，`ProductedRoute` 在進入 `/admin/*` 時呼叫並要求 `ADMIN`。
4. `JwtAuthenticationFilter` 驗證簽章，讀取 user 與角色，比對 `token_version`，通過後以 `ROLE_USER`、`ROLE_ADMIN` 設定身分。

token 無效時 Filter **不會直接拒絕**，而是以匿名身分往下走，由授權規則決定是否回 401。登入後 axios 會在所有請求帶上 token，若在 Filter 拒絕，過期 token 也會打壞公開的前台 API。

### Admin 到 Front 的資料連動

Admin 與 Front 讀寫同一批資料表，差別只在篩選條件：

- 產品：Front 只回 `is_enabled = true`。
- 文章：Front 只回 `is_public = true`，清單不含 `content`。

下架或改為不公開後，Front 的清單立即看不到，單筆查詢回 404。

### 購物與結帳

```
決定購物車 → 有 token：帳號的 carts；沒有：X-Cart-Id 的訪客 carts（CartOwnerArgumentResolver）
加入購物車 → cart_lines（只存 product、qty、coupon）
套用優惠券 → 這台購物車的所有 cart_lines 寫入 coupon_id
讀取購物車 → 依目前售價與優惠券即時計算金額
登入       → 前端呼叫 /cart/merge，訪客 cart_lines 移到帳號的 carts，刪除訪客 carts
建立訂單   → 需要 USER；交易內寫入 orders（含 user_id）、order_items（快照），並清空帳號的 cart_lines
付款       → 更新 is_paid、paid_date
```

購物車金額跟著最新售價變動；訂單一經建立就固定，之後改價或刪除產品都不影響。

## 已知限制

### 後端

- **註冊沒有次數限制，且會透露 email 是否已註冊。** 登入有次數限制，註冊沒有，可以用來大量建立帳號或探測 email。正式上線前應加上依 IP 的速率限制或驗證碼。
- **訪客購物車不會自動清除。** 沒有登入就離開的訪客購物車會一直留在 `carts`。流量變大時要加上定期清除（例如 30 天沒有更新的訪客購物車）。
- **`X-Cart-Id` 是訪客購物車唯一的保護。** 知道 id 的人可以看到、修改那台購物車。id 是隨機 UUID，只存在該瀏覽器的 localStorage，與登入 token 的風險等級相同。
- **同一個訪客第一次同時送出兩個加入購物車的請求**，可能因 `guest_id` 唯一限制讓其中一個失敗（400 `資料不符合限制，請確認後重試`），重試即可。前端一次只送一個，實際上不會發生。
- **只有 `GET /order/{id}` 的 UUID 保護訂單個資。** 知道訂單 id 的人都能查詢。這是前端完成頁需要的公開行為。
- **圖片存在本機磁碟。** 多台伺服器或無狀態容器部署時，需要改用共用儲存空間，並調整 `ImageStorageService`。
- **登入次數限制存在記憶體。** 重啟後歸零，多台伺服器之間也不共用計數，只適用單一實例部署。要水平擴充時改用 Redis 等共用儲存。
- 開發用預設密鑰與密碼寫在 `application.properties`。以 prod profile 部署時，沒有覆寫就拒絕啟動；**不用 prod profile 部署就不會檢查。**

### 前端

目前沒有已知的前端問題。
