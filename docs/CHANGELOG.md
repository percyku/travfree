# 更新日誌

## [Unreleased]

### Added

- 新增 Spring Boot 後端，實作 Hexschool 電商 API 的全部 37 個端點，前端不需修改程式碼即可串接。
- 認證：Spring Security + JWT（HS256），接受裸 token 與 `Bearer` 兩種格式；登出會撤銷該帳號既有 token。
- 啟動時建立預設 admin 帳號 `admin@gmail.com`。
- Admin：產品、文章、訂單、優惠券管理，以及圖片上傳（jpg、jpeg、png，3MB 以內，檢查檔案內容）。
- Front：產品與文章瀏覽、購物車、優惠券、結帳、付款。
- PostgreSQL 資料模型：訂單保存下單當下的產品與優惠券快照。
- 統一的 JSON 錯誤格式 `{ success: false, message }`。
- `backend/docker-compose.yml` 提供 PostgreSQL 16。
- 62 個整合測試，使用 H2 PostgreSQL 模式。
- `docs/` 專案文件。

### Changed

- `backend/pom.xml` 新增 test scope 的 H2 相依性。

### Fixed

- 分頁查無資料時，`current_page` 改為 0（原本是 1），與 Hexschool 實際回應一致。

### 與 Hexschool 的差異

- `GET ~/orders` 改為需要 admin token，避免公開全部訂單個資。
- Admin 文章清單包含 `content`，避免前端編輯時覆寫內文。
- 其他差異見 [ARCHITECTURE.md](ARCHITECTURE.md)。
