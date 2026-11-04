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
npm run openapi:preview  # 產生 docs/openapi.html 並開啟
npm run openapi:mock     # 依 spec 啟動 mock server（http://localhost:4010）
```

## 必守規則

- 目前不修改 `frontend/` 的程式碼，也不修正其中的 bug；發現問題記錄到 `docs/ARCHITECTURE.md` 的已知限制。使用者決定開始前端開發時，移除這條規則，改依 `frontend/CLAUDE.md`。
- `GET /orders` 需要 admin token，這是刻意與 Hexschool 不同的設計。

## 在子資料夾啟動 Claude Code

在根目錄啟動，並說明這次只改哪一區，最簡單。若要在子資料夾啟動，要讓 Claude 能寫入 `docs/`：

```bash
cd backend && claude --add-dir ../docs
```

## 測試策略

- 完整的單元測試與前後端整合測試延後到主要功能完成後再做。
- 例外：後端每個新 API，至少要有通過契約驗證的整合測試，並涵蓋主要錯誤情境。

## 文件維護

每次功能或 API 有變更，都要同步更新 `docs/`，使用繁體中文，只改有變動的部分：

- `openapi.yaml`：端點、欄位、錯誤情境。
- `FEATURES.md`：更新狀態表，寫明查詢參數、業務邏輯、錯誤情境。
- `ARCHITECTURE.md`：更新路由表與 DB Schema。
- `CHANGELOG.md`：格式為 `## [版本] - YYYY-MM-DD`，未定版放 `## [Unreleased]`。
- 開發計畫放 `docs/plans/YYYY-MM-DD-<feature>.md`，完成後用 `mv` 移到 `docs/plans/archive/`。

## Git

`main` 是預設分支。commit 或 push 前要先取得使用者同意。
