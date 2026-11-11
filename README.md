# travfree

[![CI](https://github.com/percyku/travfree/actions/workflows/ci.yml/badge.svg)](https://github.com/percyku/travfree/actions/workflows/ci.yml)

FreeTrav 旅遊電商：以旅遊行程為商品的電商網站，包含 React 前端與 Spring Boot 後端。

管理者在後台建立行程、文章與優惠券，訪客在前台瀏覽、加入購物車、套用優惠碼並結帳，管理者再到後台處理訂單。後端最初仿照[六角學院電商 API](https://hexschool.github.io/ec-courses-api-swaggerDoc/#/) 實作，之後依實際需求補強了安全性與結帳流程。

## 功能

**前台**

- 行程列表、分類篩選、搜尋與行程介紹
- 旅遊文章
- 購物車、優惠碼套用與移除
- 結帳：送出時比對金額，價格或優惠在填寫資料期間有變動，會先請顧客確認
- 訂單完成頁付款（只標記付款狀態，沒有串接金流）
- 會員註冊與登入（Header 的「登入／註冊」）

**後台**

- JWT 登入，只接受管理者帳號，失敗次數過多會暫時鎖定
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
travfree/
├── frontend/   # React 前端
├── backend/    # Spring Boot 後端
├── docs/       # 文件與 API 規格（openapi.yaml）
└── scripts/    # 根目錄工具（Swagger UI 預覽）
```

## 啟動與停止

有兩種方式：**Docker** 一次啟動全部，最接近部署的狀態；**開發模式**讓前後端在本機執行，改程式存檔後立即生效。

第一次使用時先下載專案：

```bash
git clone https://github.com/percyku/travfree.git
cd travfree
```

### 方式一：Docker 一次啟動全部

只需要 Docker。在根目錄執行：

| 要做什麼 | 指令 |
|---|---|
| 第一次啟動，或程式有修改過 | `docker compose up -d --build` |
| 再次啟動（程式沒改） | `docker compose up -d` |
| 查看各服務的狀態 | `docker compose ps` |
| 查看後端 log | `docker compose logs -f backend`（按 Ctrl+C 離開，服務不會停止） |
| **停止** | `docker compose down`（資料會保留） |
| 停止並**刪除所有資料** | `docker compose down -v`（資料庫與上傳的圖片都會刪除，無法復原） |

啟動後開啟 `http://localhost:8000`。沒有 `.env` 時使用開發設定；部署時的設定見 [docs/README.md](docs/README.md#docker)。

### 方式二：開發模式（前後端分別啟動）

需要 JDK 21、Node.js 與 Docker。資料庫用 Docker，前端與後端各開一個終端機執行：

| 服務 | 啟動 | 停止 | 網址 |
|---|---|---|---|
| 資料庫 | 在根目錄 `docker compose up -d db` | 在根目錄 `docker compose down` | `localhost:5432` |
| 後端 | `cd backend`<br>`JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run` | 在該終端機按 Ctrl+C | `http://localhost:8080/v2` |
| 前端 | `cd frontend`<br>`npm run dev` | 在該終端機按 Ctrl+C | `http://localhost:5173` |

- 依序啟動：資料庫 → 後端 → 前端。停止時順序不拘。
- 前端第一次執行前，先在 `frontend/` 執行 `cp .env.example .env.local` 與 `npm install`。
- 系統預設的 JDK 就是 21 時，後端可以省略 `JAVA_HOME=...`，直接執行 `./mvnw spring-boot:run`。
- 兩種方式用的是同一份資料庫。從 Docker 切換到開發模式時，先執行 `docker compose down`，再執行 `docker compose up -d db`。

### 資料：種子與備份

`docker compose down -v` 或換新電腦之後，不用再手動建立資料。以下指令都在根目錄執行，需要 Node.js：

| 要做什麼 | 指令 |
|---|---|
| 匯入範例資料（30 筆產品、5 篇文章、1 張優惠券） | `npm run seed` |
| 開發模式匯入 | `API_BASE=http://localhost:8080/v2 npm run seed` |
| 建立展示會員 `demo@example.com` / `Demo2026` 與他的 2 筆訂單（只對本機） | `npm run seed:demo` |
| 把目前後台的內容存成新的範例資料 | `npm run seed:export` |
| 備份整個資料庫（含訂單、帳號與上傳的圖片） | `npm run db:backup` |
| 從備份還原（會覆蓋現有資料） | `npm run db:restore -- backups/travfree-<時間>.dump` |

- **範例資料**（`scripts/seed/data.json`）在 git 裡，透過 API 匯入。已存在的資料會略過，重複執行不會重複新增。不含帳號與訂單。
- **展示會員**（`npm run seed:demo`）要在 `npm run seed` 之後執行：透過 API 註冊會員、加入購物車並結帳（一筆套用 `Test50` 且已付款、一筆未付款），訂單會對應到這個帳號。密碼是公開的，所以只能對 `localhost` 執行；已經有展示訂單時不會重複下單。
- **備份**存在 `backups/`，**不進 git**：裡面有訂單個資與密碼雜湊，只留在自己的電腦。
- 典型用法：`docker compose down -v` 清空 → `docker compose up -d --build` → `npm run seed` →（需要會員訂單時）`npm run seed:demo`。

### 登入

開啟 `http://localhost:8000/#/login`（Docker）或 `http://localhost:5173/#/login`（開發模式），以本機開發用的預設管理者登入：

| 帳號 | 密碼 |
|---|---|
| `admin@gmail.com` | `Test123456` |

一般會員從前台 Header 的「註冊」建立帳號（`/#/signup`），一般會員不能進入後台。

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

# 在根目錄：以 Playwright 在獨立的 Docker 環境走完主要流程
npm run e2e
npm run e2e -- --headed       # 開啟瀏覽器視窗，看測試自動操作
cd e2e && npm run report      # 查看上一次的報告（http://localhost:9323）
```

E2E 的其他選項與報告內容見 [docs/TESTING.md](docs/TESTING.md#e2e-測試)。

後端以整合測試為主，走真實的 Security、JWT 與資料庫流程，所有回應都會對照 `openapi.yaml` 驗證。前端用 Vitest 與 React Testing Library 測主要流程，以 MSW 模擬 API，請求與回應同樣對照 `openapi.yaml` 檢查。push 到 `main` 或開 PR 時，GitHub Actions 會自動執行 spec 檢查與前後端的測試，並以 docker compose 實際啟動一次，做基本檢查與 E2E 測試。

## 文件

| 文件 | 內容 |
|---|---|
| [docs/README.md](docs/README.md) | 開發環境、環境變數、部署 |
| [docs/FEATURES.md](docs/FEATURES.md) | 功能與業務規則、錯誤情境 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架構、路由表、資料庫結構、與 Hexschool 的差異、已知限制 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開發規範與新增功能的流程 |
| [docs/TESTING.md](docs/TESTING.md) | 測試規範與執行方式 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 更新日誌 |
