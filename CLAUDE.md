# FreeTrav

Vite + React 前端（`frontend/`）搭配 Spring Boot 後端（`backend/`）。
後端仿照六角學院電商 API，讓現有前端無縫串接。詳細文件從 `docs/README.md` 開始。

## 常用指令

```bash
# 後端（需要 JDK 21，系統預設不是 21）
cd backend
docker compose up -d
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test

# 前端連本機後端
cd frontend
VITE_APP_API_BASE=http://localhost:8080/v2 npm run dev
```

## 必守規則

- 不修改 `frontend/` 的任何檔案，也不修正其中的 bug；發現問題記錄到 `docs/ARCHITECTURE.md` 的已知限制。
- API 格式衝突時，優先順序為：前端實際讀取的欄位 > 真實 API 行為 > Swagger。
- 修改回應前先確認前端怎麼讀；時間單位混用秒與毫秒，新增欄位前要查清楚。
- `GET /orders` 需要 admin token，這是刻意與 Hexschool 不同的設計。
- 修改 entity 或 JSON 欄位後，要在真實 PostgreSQL 上驗證，H2 不足以代表。

## 文件維護

每次功能或 API 有變更，都要同步更新 `docs/`，使用繁體中文，只改有變動的部分：

- `FEATURES.md`：更新狀態表，寫明查詢參數、業務邏輯、錯誤情境。
- `ARCHITECTURE.md`：更新路由表與 DB Schema。
- `CHANGELOG.md`：格式為 `## [版本] - YYYY-MM-DD`，未定版放 `## [Unreleased]`。
- 開發計畫放 `docs/plans/YYYY-MM-DD-<feature>.md`，完成後用 `mv` 移到 `docs/plans/archive/`。
