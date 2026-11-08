# FreeTrav

Vite + React 前端（`frontend/`）搭配 Spring Boot 後端（`backend/`）。
後端仿照六角學院電商 API，讓現有前端無縫串接。詳細文件從 `docs/README.md` 開始。

各區專屬的規則在 `backend/CLAUDE.md`、`frontend/CLAUDE.md`。`docs/` 只有一份，放在根目錄，不要在子資料夾複製。

## API 契約

`docs/openapi.yaml` 是前後端唯一的 API 規格來源。

- **改 API 先改 spec。** 新增或修改端點時，先更新 `docs/openapi.yaml` 並通過 `npm run openapi:lint`，再實作。
- 後端的整合測試會自動驗證每個回應都符合 spec，spec 和實作不一致時測試會失敗。
- 前端只依 spec 開發，不讀後端程式碼來推測 API 格式。
- 修改既有 API 的格式時，判斷順序為：前端實際讀取的欄位 > Hexschool 真實 API 行為 > Hexschool Swagger。確定後寫進 spec。
- 時間單位混用秒與毫秒，新增欄位前要先查清楚，並在 spec 的 `description` 寫明單位。

```bash
npm install              # 根目錄工具，第一次使用時執行
npm run openapi:lint     # 檢查 spec
npm run openapi:preview  # Swagger UI（http://localhost:8081）
npm run openapi:mock     # 依 spec 啟動 mock server（http://localhost:4010）
```

## 必守規則

- `GET /orders` 需要 admin token，這是刻意與 Hexschool 不同的設計。

## 在子資料夾啟動 Claude Code

在根目錄啟動，並說明這次只改哪一區，最簡單。若要在子資料夾啟動，要讓 Claude 能寫入 `docs/`：

```bash
cd backend && claude --add-dir ../docs
```

## 測試策略

新功能依變動的範圍補上測試，寫法見 `docs/TESTING.md`：

- **後端**：每個新 API 至少要有通過契約驗證的整合測試，並涵蓋主要錯誤情境。
- **前端**：新頁面或互動要有 Vitest 測試，MSW handler 用 `src/test/contract.js` 的 `api.*` 定義，請求與回應會對 spec 檢查。
- **E2E**：新增或改變主要使用流程時，在 `e2e/tests/` 補上 Playwright 測試。
- push 前跑過相關測試；CI 會再跑一次全部的檢查，包含 E2E。

## 文件維護

每次功能或 API 有變更，都要同步更新 `docs/`，使用繁體中文，只改有變動的部分：

- `openapi.yaml`：端點、欄位、錯誤情境。
- `FEATURES.md`：更新狀態表，寫明查詢參數、業務邏輯、錯誤情境。
- `ARCHITECTURE.md`：更新路由表與 DB Schema。
- `CHANGELOG.md`：格式為 `## [版本] - YYYY-MM-DD`，未定版放 `## [Unreleased]`。
- 開發計畫放 `docs/plans/YYYY-MM-DD-<feature>.md`，完成後用 `mv` 移到 `docs/plans/archive/`。

## Git

`main` 是預設分支。commit 或 push 前要先取得使用者同意。
