# 移除 api_path，開始前端開發

## 背景

路徑中的 `react-week2-api` 是向六角學院申請的 api_path，前端以 `VITE_APP_API_PATH` 帶入。本專案已有自己的後端，不再需要這一段。前端存 token 的 cookie `react-week2-token` 也是同一時期的命名。

這次也是前端開發的起點：移除「不修改 `frontend/`」的規則，改依 `frontend/CLAUDE.md`。

## 決定（2026-11-08 與使用者確認）

- 只拿掉 `react-week2-api` 這一段，保留 `/v2` 與 `/api` 前綴：
  - `/v2/api/react-week2-api/products` → `/v2/api/products`
  - `/v2/api/react-week2-api/admin/products` → `/v2/api/admin/products`
  - `/v2/admin/signin`、`/v2/logout`、`/v2/api/user/check`、`/v2/uploads/{filename}` 不變。
- 移除後端設定 `app.api-path`。舊路徑不保留相容，直接回 404。
- 前端 cookie 名稱 `VITE_APP_TOKEN_NAME` 改為 `freetrav-token`，仍保留為環境變數；已登入的人要重新登入一次。
- 前端移除 `VITE_APP_API_PATH`。改完後前端不能再切回 Hexschool API。

## 步驟

### 階段一：spec 與後端

1. `openapi.yaml`：30 個路徑去掉 `/api/react-week2-api` 的中間段，通過 `openapi:lint`。
2. 9 個 controller 的 `@RequestMapping` 改為 `/api`、`/api/admin`；移除 `AppProperties.apiPath` 與 `app.api-path`。
3. `SecurityConfig`：`/api/*/admin/**` → `/api/admin/**`、`GET /api/*/orders` → `GET /api/orders`。**改錯會讓 admin 路由失去保護**，以 `AuthApiTest.everyAdminRouteRequiresToken` 確認。
4. 測試：`ApiTestSupport.API`、`HttpContractTest`；新增舊路徑回 404 的測試。
5. 文件：`ARCHITECTURE.md`（路由表、與 Hexschool 的差異）、`FEATURES.md`、`DEVELOPMENT.md`、`README.md`、`CHANGELOG.md`。

### 階段二：前端

6. 移除根目錄 `CLAUDE.md` 的「不修改 `frontend/`」規則，更新 `frontend/CLAUDE.md`、`DEVELOPMENT.md` 的前端調整原則。
7. 前端 10 個檔案移除 `${VITE_APP_API_PATH}/` 與對應的解構；本機 `.env.local` 移除 `VITE_APP_API_PATH`，`VITE_APP_TOKEN_NAME` 改為 `freetrav-token`，`VITE_APP_API_BASE` 改為本機後端。
8. `npm run lint`、`npm run build`，並連本機後端走一次主要流程。
