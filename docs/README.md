# FreeTrav 旅遊電商

Vite + React 前端（`frontend/`）搭配 Spring Boot 後端（`backend/`）。後端仿照六角學院電商 API 實作，前端不需修改程式碼，只要把 API base 指向本機後端就能運作。

資料由管理者在後台（Admin）建立，前台（Front）讀取同一批資料；訪客可以瀏覽、加入購物車並結帳，管理者再到後台處理訂單。

## 技術棧

| 區塊 | 技術 |
|---|---|
| 前端 | Vite 7、React 19、Redux Toolkit、React Router 7、Bootstrap 5、axios |
| 後端 | Spring Boot 3.5、Java 21、Spring Web、Spring Data JPA、Bean Validation |
| 認證 | Spring Security、JJWT 0.13（HS256）、BCrypt |
| 資料庫 | PostgreSQL 16（執行環境）、H2 PostgreSQL 模式（自動化測試） |

## 快速開始

需要 JDK 21、Node.js 與 Docker。系統預設若是其他版本的 JDK，請如下指定 `JAVA_HOME`。

```bash
# 1. 只啟動 PostgreSQL（在根目錄）
docker compose up -d db

# 2. 啟動後端（http://localhost:8080/v2）
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run

# 3. 另開終端機啟動前端（http://localhost:5173）
cd frontend
npm run dev
```

前端的 `.env.local` 不在 git 裡，新環境從範本複製：`cp frontend/.env.example frontend/.env.local`。內容如下：

```bash
VITE_APP_API_BASE=http://localhost:8080/v2
VITE_APP_API_COOKIE_PATH=/
VITE_APP_TOKEN_NAME=freetrav-token
```

| 變數 | 說明 |
|---|---|
| `VITE_APP_API_BASE` | 後端網址，含 `/v2`。連 mock server 時改為 `http://localhost:4010` |
| `VITE_APP_API_COOKIE_PATH` | 存 token 的 cookie 路徑 |
| `VITE_APP_TOKEN_NAME` | 存 token 的 cookie 名稱，後端不讀 cookie，只有前端使用 |

啟動時指定的環境變數會優先於 `.env.local`，例如 `VITE_APP_API_BASE=http://localhost:4010 npm run dev`。修改 `.env.local` 後要重啟開發伺服器。

前端已不再使用 `VITE_APP_API_PATH`，API 路徑中也沒有 `react-week2-api` 這一段，所以不能再連到 Hexschool 的 API。

開啟 `http://localhost:5173/#/login`，以預設管理者登入：

| 帳號 | 密碼 |
|---|---|
| `admin@gmail.com` | `Test123456` |

新資料庫沒有任何產品或文章，請先到後台建立，前台才會有內容。

要一次啟動前端、後端與資料庫，見下方的 [Docker](#docker)。

## API 契約

`docs/openapi.yaml` 是前後端唯一的 API 規格。根目錄的工具：

```bash
npm install              # 第一次使用時執行
npm run openapi:lint     # 檢查 spec
npm run openapi:preview  # Swagger UI：http://localhost:8081，可用 Try it out 直接打本機後端
npm run openapi:mock     # 依 spec 啟動 mock server（http://localhost:4010），前端可先用它開發
```

在 Swagger UI 測試需要登入的 API：先用 `POST /admin/signin` 取得 `token`，按右上角 **Authorize** 貼上，之後的請求就會帶這個 token。改完 `openapi.yaml` 重新整理頁面即可，不需要重啟。

## 環境變數

全部都有本機開發用的預設值。**部署時必須用 prod profile，並設定 `JWT_SECRET`、`ADMIN_PASSWORD` 與 `DB_PASSWORD`。**

| 變數 | 預設值 | 說明 |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/travfree` | 資料庫連線 |
| `DB_USERNAME` / `DB_PASSWORD` | `travfree` / `travfree` | 資料庫帳密 |
| `JWT_SECRET` | 開發用字串 | 簽章金鑰，至少 32 bytes，否則啟動失敗 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@gmail.com` / `Test123456` | 預設管理者，只在帳號不存在時建立 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081` | 允許的前端來源，逗號分隔 |
| `PUBLIC_BASE_URL` | `http://localhost:8080/v2` | 上傳圖片網址的開頭 |
| `UPLOAD_DIR` | `./uploads` | 圖片存放目錄 |
| `SPRING_PROFILES_ACTIVE` | 無 | 部署時設為 `prod` |

## 部署

設定 `SPRING_PROFILES_ACTIVE=prod` 後，`application-prod.properties` 會清掉三項開發預設值，由 `ProductionConfigCheck` 在連線資料庫前檢查。下列情況會拒絕啟動，錯誤訊息列出所有有問題的變數：

- `JWT_SECRET`、`DB_PASSWORD`、`ADMIN_PASSWORD` 未設定或空白。
- 等於開發用的預設值。
- `JWT_SECRET` 不足 32 bytes。

```text
java.lang.IllegalStateException: prod profile 的設定不完整，拒絕啟動：
  - JWT_SECRET 未設定
  - DB_PASSWORD 不可使用開發用的預設值
```

`ADMIN_PASSWORD` 只在 admin 帳號不存在時用來建立帳號，之後修改它不會改變既有密碼，但 prod profile 仍要求設定。`PUBLIC_BASE_URL`、`CORS_ALLOWED_ORIGINS` 不檢查，但預設值是 localhost，部署時也要設定。

**反向代理。** 登入次數限制以 IP 計算，預設取連線的來源位址，不信任 `X-Forwarded-For`，避免被偽造。放在 Nginx、負載平衡器等反向代理後面時，所有請求的來源都會是代理本身，要設定 `SERVER_FORWARD_HEADERS_STRATEGY=native`，並確認代理會覆寫（而不是附加）使用者傳來的 `X-Forwarded-For`。docker compose 已經這樣設定。

設定 `native` 之後，代理**不要**單獨帶 `X-Forwarded-Proto`：Tomcat 收到它會把連接埠改成 80/443，非預設連接埠（例如 `:8000`）的同源請求會被誤判為跨來源，回 403 `Invalid CORS request`。在前面加上處理 HTTPS 的負載平衡器時，要連同 `X-Forwarded-Port` 一起設定。

## Docker

根目錄的 `docker-compose.yml` 啟動三個服務：

```
瀏覽器 ──► frontend（nginx，http://localhost:8000）
             ├─ /        → React 打包後的靜態檔
             └─ /v2/...  → backend:8080 ──► db（PostgreSQL 16）
```

前後端是同一個網址，不需要設定 CORS。

```bash
docker compose up -d --build   # 建置並啟動全部
docker compose up -d db        # 只啟動資料庫（開發模式）
docker compose logs -f backend # 查看後端 log
docker compose down            # 停止；加上 -v 會連資料一起刪除
./scripts/smoke-test.sh        # 基本檢查，部署設定要帶 ADMIN_PASSWORD=...
```

**設定。** 沒有 `.env` 時使用開發設定，帳密與 `./mvnw spring-boot:run` 相同。部署時複製範本並填入密鑰：

```bash
cp .env.example .env   # 設定 DB_PASSWORD、JWT_SECRET、ADMIN_PASSWORD，SPRING_PROFILES_ACTIVE=prod
```

| 變數 | 預設值 | 說明 |
|---|---|---|
| `APP_PORT` | `8000` | 對外的連接埠 |
| `PUBLIC_BASE_URL` | `http://localhost:8000/v2` | 上傳圖片網址的開頭，要與實際網址一致 |
| `SPRING_PROFILES_ACTIVE`、`DB_PASSWORD`、`JWT_SECRET`、`ADMIN_EMAIL`、`ADMIN_PASSWORD` | 開發預設值 | 同上方的環境變數；`.env` 沒有設定時不傳入，由後端使用預設值 |

**資料。** 資料庫存在 volume `backend_postgres-data`，沿用原本 `backend/docker-compose.yml` 建立的 volume，所以開發模式與 Docker 用的是同一份資料。上傳的圖片存在 volume `travfree_uploads`。

- `DB_PASSWORD` 只在 volume 第一次建立時生效。既有資料庫要換密碼時，先在資料庫內執行 `ALTER USER travfree PASSWORD '...'`。
- 圖片的 `imageUrl` 以上傳當時的 `PUBLIC_BASE_URL` 開頭。開發模式（`:8080`）上傳的圖片存在 `backend/uploads/`，在 Docker 環境不會顯示。

**映像。**

- `backend/Dockerfile`：JDK 映像打包 jar（略過測試，測試由 CI 另外跑），JRE 映像以非 root 使用者執行。
- `frontend/Dockerfile`：Node 映像建置，nginx 映像提供靜態檔。`VITE_` 變數在建置時寫進 JS，預設 `VITE_APP_API_BASE=/v2`（相對路徑），要改用 `--build-arg`。nginx 設定在 `frontend/nginx.conf`，`client_max_body_size` 放寬為 10m，讓超過 3MB 的上傳由後端回 JSON 錯誤。
- 資料庫的連接埠只開給本機（`127.0.0.1:5432`），不對外開放。

## 文件索引

| 文件 | 內容 |
|---|---|
| [openapi.yaml](openapi.yaml) | **API 契約**：所有端點的請求、回應與錯誤情境 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系統架構、路由表、DB Schema、資料流、與 Hexschool 的差異 |
| [FEATURES.md](FEATURES.md) | 功能狀態與行為描述（查詢參數、業務邏輯、錯誤情境） |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 開發規範、命名規則、新增功能流程 |
| [TESTING.md](TESTING.md) | 測試規範與執行方式 |
| [CHANGELOG.md](CHANGELOG.md) | 更新日誌 |
| [plans/](plans/) | 開發計畫，完成後移至 `plans/archive/` |
