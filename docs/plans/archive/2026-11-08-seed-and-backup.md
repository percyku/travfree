# 種子資料與資料庫備份

## 目標

`docker compose down -v` 或換新環境之後，不必再手動建立資料。

- **種子資料**：網站內容（產品、文章、優惠券）放進 repo，透過 API 匯入。
- **備份與還原**：本機完整保存資料庫（含訂單與帳號），備份檔不進 git。

## 種子資料

- `scripts/seed/data.json`：產品、文章、優惠券，不含 id 與 `num`。文章保留 `create_at`，排序與原本相同。
- `npm run seed`（`scripts/seed.mjs`）：以 admin 登入，透過 API 新增。產品與文章以標題、優惠券以優惠碼判斷是否已存在，已存在就略過，重複執行不會產生重複資料。
- `npm run seed:export`（`scripts/seed-export.mjs`）：從執行中的後端重新匯出 `data.json`，在後台新增內容後可以更新種子。
- 預設連 `http://localhost:8000/v2`（Docker），開發模式用 `API_BASE=http://localhost:8080/v2`。帳密讀 `ADMIN_EMAIL`、`ADMIN_PASSWORD`，預設為開發用帳密。
- 不含 admin 帳號（後端啟動時自動建立，放進種子會讓部署的 `ADMIN_PASSWORD` 失效）與訂單（測試時填的個資）。
- 只用 Node 內建功能，不需要安裝套件。

## 備份與還原

- `npm run db:backup`：`pg_dump` 存到 `backups/travfree-<時間>.dump`；後端容器在執行時，一併把上傳的圖片存成 `backups/travfree-<時間>-uploads.tar.gz`。
- `npm run db:restore -- <檔案>`：先要求輸入 `yes` 確認（`--yes` 略過），停止後端容器、`pg_restore --clean`、還原圖片，再啟動後端。
- `backups/` 加入 `.gitignore`：內含個資與密碼雜湊。

## CI

Docker compose job 在 smoke test 之後：

1. `npm run seed`，再執行一次確認全部略過（不會重複新增）。
2. `npm run db:backup` → `docker compose down -v` → 重新啟動 → `npm run db:restore -- --yes <檔案>`。
3. 再執行 `npm run seed`，全部略過代表資料已經還原。

## 進度

- 2026-11-08：完成。已從本機資料庫匯出種子（產品 30、文章 5、優惠券 1，確認不含個資）。在獨立的測試環境驗證：全新資料庫匯入、重複執行全部略過、備份 → `down -v` → 還原；本機真實資料的備份也還原成功（含訂單 6、帳號 1、上傳的圖片）。
