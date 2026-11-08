# FreeTrav 旅遊電商

[![CI](https://github.com/percyku/freetrav/actions/workflows/ci.yml/badge.svg)](https://github.com/percyku/freetrav/actions/workflows/ci.yml)

以旅遊行程為商品的電商網站，包含 React 前端與 Spring Boot 後端。

管理者在後台建立行程、文章與優惠券，訪客在前台瀏覽、加入購物車、套用優惠碼並結帳，管理者再到後台處理訂單。後端最初仿照[六角學院電商 API](https://hexschool.github.io/ec-courses-api-swaggerDoc/#/) 實作，之後依實際需求補強了安全性與結帳流程。

## 功能

**前台**

- 行程列表、分類篩選、搜尋與行程介紹
- 旅遊文章
- 購物車、優惠碼套用與移除
- 結帳：送出時比對金額，價格或優惠在填寫資料期間有變動，會先請顧客確認
- 訂單完成頁付款（只標記付款狀態，沒有串接金流）

**後台**

- JWT 登入，失敗次數過多會暫時鎖定
- 行程管理與圖片上傳
- 文章管理（摘要、內文、分類）
- 訂單管理：付款與外送狀態、使用的優惠券
- 優惠券管理：實付比例、到期日、啟用與停用

## 技術

| 區塊 | 技術 |
|---|---|
| 前端 | Vite 7、React 19、Redux Toolkit、React Router 7、Bootstrap 5、axios |
| 後端 | Spring Boot 3.5、Java 21、Spring Data JPA、Bean Validation |
| 認證 | Spring Security、JWT（HS256）、BCrypt |
| 資料庫 | PostgreSQL 16；自動化測試使用 H2 的 PostgreSQL 模式 |
| API 契約 | OpenAPI 3.0（手寫）、Redocly、Swagger UI、Prism mock server |

## 專案結構

```text
freetrav/
├── frontend/   # React 前端
├── backend/    # Spring Boot 後端
├── docs/       # 文件與 API 規格（openapi.yaml）
└── scripts/    # 根目錄工具（Swagger UI 預覽）
```

## 快速開始

需要 JDK 21、Node.js 與 Docker。

```bash
git clone https://github.com/percyku/freetrav.git
cd freetrav

# 1. 啟動 PostgreSQL
cd backend
docker compose up -d

# 2. 啟動後端：http://localhost:8080/v2
#    系統預設不是 JDK 21 時，用 JAVA_HOME 指定
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run

# 3. 另開終端機，啟動前端：http://localhost:5173
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

開啟 `http://localhost:5173/#/login`，以本機開發用的預設管理者登入：

| 帳號 | 密碼 |
|---|---|
| `admin@gmail.com` | `Test123456` |

新的資料庫是空的，請先到後台建立行程與文章，前台才會有內容。

> 預設帳密與 JWT 金鑰只供本機開發使用。部署時使用 `prod` profile，沒有另外設定 `JWT_SECRET`、`DB_PASSWORD`、`ADMIN_PASSWORD` 就會拒絕啟動，詳見 [docs/README.md](docs/README.md#部署)。

## API 規格

[`docs/openapi.yaml`](docs/openapi.yaml) 是前後端唯一的 API 規格。修改 API 時先改規格，後端的整合測試會自動檢查每個回應是否符合規格。

```bash
npm install              # 根目錄工具，第一次使用時執行
npm run openapi:lint     # 檢查規格
npm run openapi:preview  # Swagger UI：http://localhost:8081，可直接呼叫本機後端
npm run openapi:mock     # 依規格啟動 mock server：http://localhost:4010
```

## 測試

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test   # 不需要 Docker

cd frontend
npm test
npm run lint
```

後端以整合測試為主，走真實的 Security、JWT 與資料庫流程，所有回應都會對照 `openapi.yaml` 驗證。前端用 Vitest 與 React Testing Library 測主要流程，以 MSW 模擬 API，請求與回應同樣對照 `openapi.yaml` 檢查。push 到 `main` 或開 PR 時，GitHub Actions 會自動執行 spec 檢查與前後端的測試。

## 文件

| 文件 | 內容 |
|---|---|
| [docs/README.md](docs/README.md) | 開發環境、環境變數、部署 |
| [docs/FEATURES.md](docs/FEATURES.md) | 功能與業務規則、錯誤情境 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架構、路由表、資料庫結構、與 Hexschool 的差異、已知限制 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開發規範與新增功能的流程 |
| [docs/TESTING.md](docs/TESTING.md) | 測試規範與執行方式 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 更新日誌 |
