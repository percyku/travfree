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
# 1. 啟動 PostgreSQL
cd backend
docker compose up -d

# 2. 啟動後端（http://localhost:8080/v2）
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run

# 3. 另開終端機啟動前端（http://localhost:5173）
cd frontend
VITE_APP_API_BASE=http://localhost:8080/v2 npm run dev
```

前端的 `.env.local` 不在 git 裡，新環境需要自行建立：

```bash
VITE_APP_API_BASE=https://ec-course-api.hexschool.io/V2
VITE_APP_API_PATH=react-week2-api
VITE_APP_API_COOKIE_PATH=/
VITE_APP_TOKEN_NAME=react-week2-token
```

第 3 步的環境變數優先於 `frontend/.env.local`，所以不用改任何前端檔案。少了它，前端會繼續連線到 Hexschool。若 5173 已有開發伺服器在跑，要先關掉重開，環境變數才會生效。

開啟 `http://localhost:5173/#/login`，以預設管理者登入：

| 帳號 | 密碼 |
|---|---|
| `admin@gmail.com` | `Test123456` |

登入頁預設帶入的是另一組帳號（`Login.jsx:19`），需要手動改掉。新資料庫沒有任何產品或文章，請先到後台建立，前台才會有內容。

## API 契約

`docs/openapi.yaml` 是前後端唯一的 API 規格。根目錄的工具：

```bash
npm install              # 第一次使用時執行
npm run openapi:lint     # 檢查 spec
npm run openapi:preview  # 產生 docs/openapi.html 並用瀏覽器開啟（不進 git）
npm run openapi:mock     # 依 spec 啟動 mock server（http://localhost:4010），前端可先用它開發
```

## 環境變數

全部都有本機開發用的預設值。**部署時必須覆寫 `JWT_SECRET`、`ADMIN_PASSWORD` 與 `DB_PASSWORD`。**

| 變數 | 預設值 | 說明 |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/travfree` | 資料庫連線 |
| `DB_USERNAME` / `DB_PASSWORD` | `travfree` / `travfree` | 資料庫帳密 |
| `JWT_SECRET` | 開發用字串 | 簽章金鑰，至少 32 bytes，否則啟動失敗 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@gmail.com` / `Test123456` | 預設管理者，只在帳號不存在時建立 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允許的前端來源，逗號分隔 |
| `PUBLIC_BASE_URL` | `http://localhost:8080/v2` | 上傳圖片網址的開頭 |
| `UPLOAD_DIR` | `./uploads` | 圖片存放目錄 |

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
