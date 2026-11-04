# Spring Boot 後端實作計畫：取代 Hexschool 電商 API

## Context

`frontend/` 是已完成的 Vite + React 旅遊電商，目前呼叫六角學院 API；`backend/` 只有 Spring Boot 3.5.16 空殼與 `pom.xml`。
目標是在**不改任何前端檔案**的前提下，實作相容的後端（Spring Security + JWT、PostgreSQL、JPA），讓前端切換 API base 就能運作：
以預設 admin 登入 → 在 Admin 維護資料 → Front 讀到資料 → 購物車結帳。同時建立並維護 `docs/`。

已確認的決定：
- 執行環境用 PostgreSQL（docker-compose），自動化測試用 H2 PostgreSQL 模式。
- 不實作 Google 登入；`spring-security-oauth2-jose` 保留不動。
- `GET /orders` 改為需要 admin token（與 Hexschool 唯一的刻意差異，寫入文件）。

## 相容性依據

依據三個來源：Swagger（`swagger_output.json`，37 個端點）、前端原始碼、真實 API 的唯讀請求。
**三者衝突時，優先順序為：前端實際讀取的欄位 > 真實 API 行為 > Swagger。**

| 項目 | Swagger | 實際行為／前端需求（採用） |
|---|---|---|
| `GET /products` 的 `products` | 物件 map | 陣列（`/admin/products`、`/products/all` 也是陣列） |
| `GET /admin/products/all` | 物件 map | 照 Swagger（前端未使用） |
| `GET /article/{id}` | `articles` + pagination | `{ success, article }`，前端讀 `res.data.article` |
| 未帶／無效 token | 403 | **401** `{"success":false,"message":"驗證錯誤, 請重新登入"}` |
| 不存在的訂單 `GET /order/{id}` | — | **200** `{success:true, order:null}` |
| 不存在的產品／文章 | — | 404 `找不到產品` / `找不到文章` |
| 分頁 | — | 每頁 10 筆；`page` 超過末頁時回傳最後一頁 |
| `num` | 像固定序號 | 分頁清單中的名次，從 1 開始；`/products/all` 不含 |
| 排序 | — | 分頁清單新到舊，`/products/all` 舊到新 |
| `signin` 成功回應 | `status:true` | `success:true`，`expired` 為毫秒 |
| 訂單 `status` | 無此欄位 | 前端有使用，存 0–3，要接受字串（`"1"`），預設 0 |

其他前端限制：
- `Authorization` 是**裸 token，沒有 `Bearer`**（`ProductedRoute.jsx:19`）。Filter 兩種格式都接受。
- 時間單位不一致：訂單 `create_at`／`paid_date` 為**秒**；文章 `create_at` 由前端傳 `Date.now()`（毫秒），原值保存，不換算。
- `is_enabled` 是 0/1 整數，`isPublic`／`is_paid` 是布林。命名混用 snake_case 與 camelCase，每個 DTO 欄位用 `@JsonProperty` 明確指定。
- 前端會多傳 `id`、`num` 等欄位，一律忽略。
- 上傳欄位名稱是 `file-to-upload`，回應 `{success, imageUrl}`。
- Admin 文章編輯直接用清單資料帶入 `content`。Hexschool 的 admin 清單不含 `content`，編輯時會被覆寫成 `"default"`；本後端的 admin 清單**會包含 `content`**，避免資料遺失。Front 清單維持不含。

## 架構

基礎套件 `com.percyku.backend`，採 controller → service → repository 分層。沒有 Lombok，DTO 用 record。

```
config/      SecurityConfig、CorsProperties、AppProperties、WebConfig（/uploads 靜態資源）、AdminSeeder
security/    JwtService、JwtAuthenticationFilter、JSON 401/403 handler
entity/      User、Product、Coupon、Article、CartItem、Order、OrderItem
repository/  各 entity 的 JpaRepository
dto/         DataRequest<T>（{data:...} 外層）、PaginationDto、各模組 request/response record
service/     AuthService、ProductService、CouponService、ArticleService、CartService、OrderService、ImageStorageService
controller/  AuthController、Admin*Controller、Front*Controller
exception/   ApiException(status, message)、GlobalExceptionHandler
```

路由：
- `server.servlet.context-path=/v2`，比照 Swagger。
- Controller 用 `@RequestMapping("/api/${app.api-path}...")`，`app.api-path` 預設 `react-week2-api`。

## 認證授權

- JJWT HS256，claim：`sub`=uid、`ver`=tokenVersion；TTL 7 天；`JWT_SECRET` 由環境變數覆寫。
- `POST /admin/signin` 回 `{success, message, uid, token, expired}`；失敗一律回 400 `登入失敗`，不透露是帳號或密碼錯誤。
- Filter 遇到無效 token 時**不直接拒絕**，以匿名身分往下走，否則過期 token 會打壞公開的 Front API。由授權層決定是否回 401。
- Filter 每次讀取 user、比對 `token_version`。`POST /logout` 遞增版本讓既有 token 失效，未帶 token 時仍回 200。
- 無 session、關閉 CSRF／formLogin／httpBasic；密碼用 BCrypt。
- 授權規則（依序）：
  1. `OPTIONS` → permit
  2. `/api/user/check` → authenticated
  3. `/api/*/admin/**`、`GET /api/*/orders` → `ROLE_ADMIN`
  4. `/api/**`、`/admin/signin`、`/logout`、`GET /uploads/**`、`/error` → permit
  5. 其餘 → deny
- CORS：`app.cors.allowed-origins`，預設 `http://localhost:5173`、`http://127.0.0.1:5173`，要允許 `Authorization` header。
- `AdminSeeder`（ApplicationRunner）：`admin@gmail.com` 不存在才建立（`Test123456`，ADMIN），可重複執行，不覆蓋既有密碼。

## 資料庫設計

主鍵皆為 UUID 字串（前端視為不透明字串；公開的 `/order/{id}` 也需要不可猜測）。

| 資料表 | 欄位 |
|---|---|
| `users` | id, email(unique), password_hash, role, token_version, created_at |
| `products` | id, title, category, unit, origin_price, price, description, content, is_enabled, image_url, images_url(jsonb), created_at |
| `coupons` | id, title, code(unique), percent, due_date(秒), is_enabled, created_at |
| `articles` | id, title, description, image, tag(jsonb), create_at(前端傳入), author, is_public, content |
| `cart_items` | id, product_id(FK, unique), qty, coupon_id(FK, nullable), created_at |
| `orders` | id, user_name, user_email, user_tel, user_address, message, total, is_paid, paid_date(秒), status, create_at(秒) |
| `order_items` | id, order_id(FK), product_id(**非 FK**), qty, total, final_total, product_snapshot(jsonb), coupon_snapshot(jsonb) |

- **Admin → Front 連動**：兩邊讀同一批資料表。Front 只回 `is_enabled=1` 的產品、`is_public=true` 的文章；未啟用的 `GET /product/{id}`、`/article/{id}` 回 404。
- **購物車即時計算**：`cart_items` 只存數量與優惠券，金額由目前售價與優惠算出。
- **訂單快照**：下單時把產品與優惠券存成快照，之後改價或刪產品不影響歷史訂單。`orders.total` 為折扣後總額，回應中 `products` 以 item id 為 key。
- 金額用整數。折扣為 `final_total = round(total * percent / 100)`，例如 percent=60 表示付 60%。
- Schema 用 `ddl-auto=update`（pom 未含 Flyway）；`open-in-view=false`；`default_batch_fetch_size=50` 避免 N+1。

## 業務規則

- **購物車**：重複加入同產品時累加 qty（前端以 `product.id` 當 React key）；`PUT` 直接設定 qty；qty 必須 ≥ 1；產品不存在或已下架回 404/400。
- **刪除連動**：刪產品時移除對應購物車項目；刪優惠券時清除購物車引用。
- **優惠券**：對目前購物車全部項目套用；之後才加入的項目不帶優惠（同 Hexschool）。找不到或停用回 404，過期回 400。`code` 重複回 400。
- **結帳**（`@Transactional`）：購物車空回 400；含已下架產品回 400；成功時建立快照、清空購物車，回 `{success, message, total, create_at, orderId}`。
- **付款** `POST /pay/{id}`：設定 `is_paid` 與 `paid_date`；已付款回 400；找不到回 404。
- **Admin 更新訂單**：只接受 `is_paid`、`status`，其餘忽略。`is_paid` false→true 由伺服器寫 `paid_date`，反向時清除；否則列表會同時顯示「付款完成」與「未付款」。
- **上傳**：jpg/jpeg/png、≤3MB，**以檔案 magic bytes 驗證**而非只看副檔名；用 UUID 重新命名；存在 `app.upload-dir`（預設 `./uploads`，加入 `.gitignore`），由 `/v2/uploads/**` 提供；回傳 `app.public-base-url` 開頭的絕對網址。
- **驗證**：Bean Validation，訊息比照 Swagger（`title 屬性不得為空`）。所有錯誤統一為 `{success:false, message}`，包含 404、405、JSON 解析失敗、檔案過大與 500。

## 實作步驟

1. `backend/pom.xml` 新增 `com.h2database:h2`（test scope）。新增 `application.properties`、`src/test/resources/application-test.properties`、`backend/docker-compose.yml`（postgres:16）；`backend/.gitignore` 加入 `uploads/`。
2. 共用基礎：exception、`DataRequest`、分頁工具、entity、repository。
3. 認證：security、`AuthController`、`AdminSeeder`。
4. Admin：產品、文章、優惠券、訂單、上傳。
5. Front：產品、文章、購物車、優惠券、訂單、付款。
6. 整合測試（見下）。
7. 建立 `docs/`。先把本計畫存為 `docs/plans/2026-11-02-spring-boot-backend.md`，完工後用 `mv` 移到 `docs/plans/archive/`。內容遵守 `ask.md` 規則，並用繁體中文撰寫：
   - `README.md`：技術棧、快速開始、文件索引
   - `ARCHITECTURE.md`：架構、頁面路由與 REST API 兩張表、DB Schema、資料流
   - `DEVELOPMENT.md`：開發規範、命名規則、新增功能流程
   - `FEATURES.md`：狀態總覽表，以及各功能的查詢參數、業務邏輯、錯誤情境
   - `TESTING.md`：測試規範
   - `CHANGELOG.md`：`## [Unreleased]`
   - 另記錄與 Hexschool 的差異及下方已知限制

## 已知限制（寫入文件，本次不處理）

**後端設計：**
- **購物車是全站共用的一台**。前端匿名呼叫，沒有 `withCredentials` 也沒有任何訪客識別，後端無法區分訪客；這與 Hexschool 相同。A 瀏覽器加入的商品 B 也看得到，結帳會清空全部。要做到每人一台必須改前端或改為同源部署。
- `/products` 等只服務一個 `api-path`，其他路徑回 404（Hexschool 視為空資料回 200）。前端不受影響。
- 新資料庫是空的，真實 API 上的 30 筆產品、5 篇文章不會自動搬移。規格要求由 Admin 建立，所以不做匯入。
- `application.properties` 含開發用預設值（JWT secret、admin 密碼），部署時必須以環境變數覆寫。

**前端現況（依規格不修改）：**
- `Login.jsx:45`、`ProductedRoute.jsx:33` 使用未解構的 `VITE_APP_API_COOKIE_PATH`，token 失效時拋 ReferenceError，舊 cookie 清不掉。
- `AdminOrders.jsx:40` 使用未定義的 `navigate`，訂單 API 回 401 時頁面會出錯。
- `Login.jsx:19` 預設帳號是 `percyku19@gmail.com`，登入時要手動改成 `admin@gmail.com`。
- 登出只清 cookie，沒有呼叫 `POST /logout`，所以 token 在到期前仍然有效。
- 前端沒有優惠券與付款的 UI，`AdminArticleModal` 也沒有 `content` 欄位。這些 API 仍依規格實作，但只能用 API 測試驗證。

## 驗證

**自動化**（`JAVA_HOME` 指向 temurin-21，系統預設是 JDK 25，不需 Docker）：
```bash
cd backend && JAVA_HOME=~/Library/Java/JavaVirtualMachines/temurin-21.0.11/Contents/Home ./mvnw test
```
`@SpringBootTest` + MockMvc 走真實 JWT 流程，涵蓋：
- 登入成功／失敗；裸 token 與 `Bearer` 皆可用；登出後 token 失效；無效 token 不影響公開 API；`GET /orders` 匿名 401
- 上述相容性表格的每一項，含 `status:"1"` 字串轉換與各處時間單位
- Admin CRUD 與 Front 可見性連動（下架後 Front 看不到）
- 購物車累加、優惠券折扣、結帳快照（下單後改價，訂單金額不變）、付款流程
- 上傳：合法圖片、假副檔名、超過 3MB

**端到端**（需啟動 Docker）：
```bash
cd backend && docker compose up -d
JAVA_HOME=... ./mvnw spring-boot:run
cd ../frontend && VITE_APP_API_BASE=http://localhost:8080/v2 npm run dev
```
Vite 中已存在的環境變數優先於 `.env.local`，所以**不用改任何前端檔案**。在瀏覽器走完：
`admin@gmail.com` 登入 → 新增產品與文章（含上傳圖片）→ 前台看到資料 → 加入購物車 → 結帳 → 成功頁 → 後台改訂單狀態。
完成後確認 `frontend/` 沒有任何變動。

## 實作結果

已完成。與上述計畫的差異：

- `CorsProperties` 併入 `AppProperties`，沒有獨立類別。
- `order_items` 多了 `sort_order` 欄位，維持購物車順序。
- `qty` 增加 9999 上限，避免累加後整數溢位。
- 另新增 `HttpContractTest`，以真實 Tomcat 驗證 CORS 與上傳上限。

驗證結果：62 個整合測試通過；在真實 PostgreSQL 上以 HTTP 呼叫走過全部 37 個端點；以無頭 Chrome 操作真實前端走完登入、後台建檔、購物、結帳與訂單處理。
