# Docker 化與 docker compose

## 目標

前端、後端、資料庫各自有映像，用根目錄的 `docker-compose.yml` 一起啟動，CI 也實際啟動一次並做基本檢查。

## 架構

```
瀏覽器 ──► frontend（nginx）
             ├─ /        → React 打包後的靜態檔
             └─ /v2/...  → backend:8080
                              │
                              ▼
                           db（PostgreSQL 16）
```

前後端同一個網址，不需要 CORS。

## 檔案

- `backend/Dockerfile`：JDK 映像打包 jar（略過測試，測試由 CI 另外跑），JRE 映像執行，非 root。
- `frontend/Dockerfile`：Node 映像 `npm run build`，nginx 映像提供 `dist/` 並轉發 `/v2`。設定在 `frontend/nginx.conf`。
- 根目錄 `docker-compose.yml`、`.env.example`；`.env` 不進 git。
- `scripts/smoke-test.sh`：對啟動好的服務做基本檢查，本機與 CI 共用。
- 刪除 `backend/docker-compose.yml`，開發時改用 `docker compose up -d db`。

## 決定

- **沿用既有的資料庫 volume**：`backend_postgres-data`（原本 `backend/docker-compose.yml` 建立的），本機資料不用搬。
- **本機預設用開發設定**：不寫 `.env` 也能啟動，帳密與既有資料庫相同。部署與 CI 在 `.env` 設定 `SPRING_PROFILES_ACTIVE=prod` 與密鑰，`ProductionConfigCheck` 會檢查。
- **client IP**：nginx 以 `X-Forwarded-For` 覆寫為真實 IP，compose 設定 `SERVER_FORWARD_HEADERS_STRATEGY=native`，否則登入次數限制會把所有人當成同一個 IP。後端預設不變，直接啟動時不信任這個 header。
- **不帶 `X-Forwarded-Proto`**：實作時發現 Tomcat 收到它會把連接埠改成 80，`:8000` 的同源寫入請求被判為跨來源而回 403。smoke test 加入這項檢查。
- **上傳大小**：nginx `client_max_body_size` 設 10m，3MB 以上的檔案由後端回 JSON 錯誤，而不是 nginx 的 413 頁面。
- **前端 `base` 改為 `/`**：原本 production 的 `/react-training-2025-final/` 是舊專案的 gh-pages 設定，一併移除 `gh-pages`。
- **上傳的圖片**存在 `uploads` volume。`imageUrl` 以上傳當時的 `PUBLIC_BASE_URL` 開頭，本機開發模式（:8080）上傳的圖片在 compose 環境不會顯示。

## CI

新增 `docker` job：產生臨時密鑰寫入 `.env`（prod profile）→ `docker compose up -d --build --wait` → `scripts/smoke-test.sh` → 失敗時輸出 logs → `docker compose down -v`。

## 驗證

- 本機 `docker compose up -d --build`，沿用既有資料，在瀏覽器走主要流程。
- prod profile 搭配全新資料庫跑 smoke test。
- 確認後端取得的是真實 client IP：從 nginx 容器以不同的 `X-Forwarded-For` 登入失敗，鎖定只影響該 IP。

## 進度

- 2026-11-08：完成。本機以開發設定沿用既有資料（30 產品、5 文章、5 訂單）；prod profile 搭配全新資料庫通過 smoke test；確認後端依 nginx 帶的 IP 計算登入限制，client 偽造的 `X-Forwarded-For` 無效。
