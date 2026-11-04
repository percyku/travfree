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

後端採 controller → service → repository 分層，基礎套件為 `com.percyku.backend`：

| 套件 | 職責 |
|---|---|
| `config` | `SecurityConfig`（授權規則、CORS）、`AppProperties`（`app.*` 設定）、`WebConfig`（圖片靜態資源）、`AdminSeeder` |
| `security` | `JwtService`、`JwtAuthenticationFilter`、`JsonSecurityErrorHandler`（JSON 格式的 401/403） |
| `entity` | JPA entity，由 `apply(request)` 接收輸入 |
| `repository` | Spring Data JPA |
| `dto` | request/response record，`ApiResponses`（回應外層）、`PagedResult`（分頁） |
| `service` | 業務邏輯與交易邊界 |
| `controller` | `Admin*` 對應 `/admin` 路由，`Front*` 對應公開路由，`AuthController` 處理認證 |
| `exception` | `ApiException`、`GlobalExceptionHandler` |

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
| 未設定的 `api_path` | 200，空資料 | 404 | 本專案只服務 `app.api-path` 一個路徑 |
| `POST /logout` | — | 遞增 `token_version`，該帳號既有 token 全部失效 | JWT 無狀態，需要版本號才能真正登出 |
| `paid_date` | 由傳入資料決定 | 由伺服器在付款狀態變更時決定 | 否則後台勾選已付款後，列表會同時顯示「付款完成」與「未付款」 |

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
| `/cartcheckout` | `CartCheckout` | 公開 | 購物車 |
| `/cartform` | `CartForm` | 公開 | 填寫訂購資料 |
| `/cartsuccess/:orderId` | `CartSuccess` | 公開 | 訂購完成 |
| `/login` | `Login` | 公開 | 管理者登入 |
| `/admin/products` | `AdminProducts` | 需登入 | 產品管理 |
| `/admin/orders` | `AdminOrders` | 需登入 | 訂單管理 |
| `/admin/articles` | `AdminArticle` | 需登入 | 文章管理 |

### REST API

路徑皆含 context-path `/v2`。下表的 `~` 代表 `/v2/api/{api_path}`，預設為 `/v2/api/react-week2-api`。

權限欄的 **Admin** 表示要帶 `ROLE_ADMIN` 的 token。詳細行為見 [FEATURES.md](FEATURES.md)。

| 方法 | 路徑 | 權限 | 前端有用 | 說明 |
|---|---|---|---|---|
| POST | `/v2/admin/signin` | 公開 | ✓ | 登入 |
| POST | `/v2/logout` | 公開 | | 登出，帶有效 token 時撤銷 |
| POST | `/v2/api/user/check` | 需登入 | ✓ | 驗證 token |
| GET | `~/admin/products` | Admin | ✓ | 產品分頁 |
| GET | `~/admin/products/all` | Admin | | 全部產品，以 id 為 key |
| POST | `~/admin/product` | Admin | ✓ | 新增產品 |
| PUT | `~/admin/product/{id}` | Admin | ✓ | 更新產品 |
| DELETE | `~/admin/product/{id}` | Admin | ✓ | 刪除產品 |
| POST | `~/admin/upload` | Admin | ✓ | 上傳圖片 |
| GET | `~/admin/orders` | Admin | ✓ | 訂單分頁 |
| PUT | `~/admin/order/{id}` | Admin | ✓ | 更新付款與外送狀態 |
| DELETE | `~/admin/order/{id}` | Admin | | 刪除訂單 |
| DELETE | `~/admin/orders/all` | Admin | | 刪除全部訂單 |
| GET | `~/admin/coupons` | Admin | | 優惠券分頁 |
| POST | `~/admin/coupon` | Admin | | 新增優惠券 |
| PUT | `~/admin/coupon/{id}` | Admin | | 更新優惠券 |
| DELETE | `~/admin/coupon/{id}` | Admin | | 刪除優惠券 |
| GET | `~/admin/articles` | Admin | ✓ | 文章分頁 |
| GET | `~/admin/article/{id}` | Admin | | 單篇文章 |
| POST | `~/admin/article` | Admin | ✓ | 新增文章 |
| PUT | `~/admin/article/{id}` | Admin | ✓ | 更新文章 |
| DELETE | `~/admin/article/{id}` | Admin | ✓ | 刪除文章 |
| GET | `~/products` | 公開 | ✓ | 上架產品分頁 |
| GET | `~/products/all` | 公開 | ✓ | 全部上架產品 |
| GET | `~/product/{id}` | 公開 | ✓ | 單一上架產品 |
| GET | `~/cart` | 公開 | ✓ | 取得購物車 |
| POST | `~/cart` | 公開 | ✓ | 加入購物車 |
| PUT | `~/cart/{id}` | 公開 | ✓ | 更新數量 |
| DELETE | `~/cart/{id}` | 公開 | ✓ | 刪除單一品項 |
| DELETE | `~/carts` | 公開 | ✓ | 清空購物車 |
| POST | `~/coupon` | 公開 | | 套用優惠券 |
| POST | `~/order` | 公開 | ✓ | 建立訂單 |
| GET | `~/orders` | **Admin** | | 訂單分頁（與 Hexschool 不同） |
| GET | `~/order/{id}` | 公開 | ✓ | 單筆訂單 |
| POST | `~/pay/{id}` | 公開 | | 付款 |
| GET | `~/articles` | 公開 | ✓ | 公開文章分頁 |
| GET | `~/article/{id}` | 公開 | ✓ | 單篇公開文章 |
| GET | `/v2/uploads/{file}` | 公開 | ✓ | 讀取上傳的圖片（靜態資源，不在 37 個 API 內） |

授權規則寫在 `SecurityConfig`，依序比對。未列入的路徑一律拒絕。

## DB Schema

主鍵皆為 Hibernate 產生的隨機 UUID 字串。前端把 id 當不透明字串；公開的 `GET /order/{id}` 也靠它不可猜測。

Schema 由 `spring.jpa.hibernate.ddl-auto=update` 維護，pom 沒有 Flyway。`update` 只會新增、不會改型別或刪欄位，變更既有欄位時要自行處理資料庫。

### `users`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `email` | varchar UNIQUE | 登入帳號 |
| `password_hash` | varchar | BCrypt |
| `role` | varchar(20) | 目前只有 `ADMIN` |
| `token_version` | int | 簽進 JWT，登出時遞增 |
| `created_at` | timestamp | |

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

### `cart_items`

全站共用一台購物車，所以沒有 `carts` 表。金額不落地，讀取時由目前售價與優惠券算出。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `product_id` | FK → products，UNIQUE | 每個產品最多一列 |
| `qty` | int | 1–9999 |
| `coupon_id` | FK → coupons，可為 null | |
| `created_at` | timestamp | 排序用 |

### `orders`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | varchar(36) PK | |
| `user_name`、`user_email`、`user_tel`、`user_address` | varchar | 收件資料 |
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

1. `Login.jsx` 呼叫 `POST /v2/admin/signin`，把 `token` 與 `expired`（毫秒）寫入 cookie `react-week2-token`。
2. 前端把 cookie 的值設為 `axios.defaults.headers.common.Authorization`，所以 header 是**裸 token，沒有 `Bearer`**。Filter 兩種格式都接受。
3. `ProductedRoute` 進入 `/admin/*` 時呼叫 `POST /v2/api/user/check`。
4. `JwtAuthenticationFilter` 驗證簽章，讀取 user，比對 `token_version`，通過後才設定身分。

token 無效時 Filter **不會直接拒絕**，而是以匿名身分往下走，由授權規則決定是否回 401。登入後 axios 會在所有請求帶上 token，若在 Filter 拒絕，過期 token 也會打壞公開的前台 API。

### Admin 到 Front 的資料連動

Admin 與 Front 讀寫同一批資料表，差別只在篩選條件：

- 產品：Front 只回 `is_enabled = true`。
- 文章：Front 只回 `is_public = true`，清單不含 `content`。

下架或改為不公開後，Front 的清單立即看不到，單筆查詢回 404。

### 購物與結帳

```
加入購物車 → cart_items（只存 product、qty、coupon）
套用優惠券 → 目前所有 cart_items 寫入 coupon_id
讀取購物車 → 依目前售價與優惠券即時計算金額
建立訂單   → 交易內寫入 orders、order_items（快照），並清空 cart_items
付款       → 更新 is_paid、paid_date
```

購物車金額跟著最新售價變動；訂單一經建立就固定，之後改價或刪除產品都不影響。

## 已知限制

### 後端

- **購物車全站共用。** 前端匿名呼叫，沒有 `withCredentials` 也沒有訪客識別，後端無法區分訪客，這與 Hexschool 相同。不同瀏覽器看到同一台購物車，任何人結帳都會清空它。要做到每人一台，必須修改前端，或改為同源部署並使用 cookie。
- **只有 `GET /order/{id}` 的 UUID 保護訂單個資。** 知道訂單 id 的人都能查詢。這是前端完成頁需要的公開行為。
- **圖片存在本機磁碟。** 多台伺服器或無狀態容器部署時，需要改用共用儲存空間，並調整 `ImageStorageService`。
- **登入沒有次數限制。** 對外部署前應加上。
- 開發用預設密鑰與密碼寫在 `application.properties`，部署時必須以環境變數覆寫。

### 前端（依規格不修改）

- `Login.jsx:45`、`ProductedRoute.jsx:33` 使用未解構的 `VITE_APP_API_COOKIE_PATH`，token 失效時會拋 ReferenceError，舊 cookie 清不掉。實際影響：畫面仍會回到登入頁，重新登入後恢復正常。
- `AdminOrders.jsx:40` 使用未定義的 `navigate`，token 失效時訂單頁會出錯，而不是導回登入頁。
- `NavAdmin.jsx` 登出只清 cookie，沒有呼叫 `POST /logout`，token 在到期前（預設 7 天）仍然有效。
- 前端沒有優惠券與付款的 UI，這兩組 API 目前只能直接呼叫。
- `.env.local` 被 `frontend/.gitignore` 排除，新 clone 的環境沒有設定檔，需要依 [README.md](README.md) 自行建立。
- `AdminArticleModal` 沒有 `content` 欄位，新文章的 `content` 一律是 `"default"`；`SingleArticle` 也不顯示 `content`。
- Bootstrap 只有在開啟動畫（約 0.5 秒）結束後才接受 `hide()`。本機 API 回應很快，若開啟 modal 後立刻送出，資料會成功但 modal 不會自動關閉，按取消即可。
