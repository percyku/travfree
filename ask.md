# 專案實作規格書：Spring Boot 後端串接既有 React 專案

**本專案旨在開發一個 Spring Boot 後端服務 (`./backend`)，以替代並完全仿照六角學院的電商 API，藉此支援既有的 React+Vite 前端應用 (`./frontend`)。**

## 📌 專案目前現況

### 🖥️ 前端 (`./frontend`)

- **技術棧**：Vite + React（已開發完成）。
- **參考 API 規格**：https://hexschool.github.io/ec-courses-api-swaggerDoc/#/
- **主要業務邏輯區分**：
  1. **管理控制台 API (Admin)**：
     - **功能模組**：產品 (Products)、訂單 (Orders)、優惠券 (Coupon)、文章 (Article)、上傳圖片 (Upload)。
     - **權限機制**：調用前需先透過 `Login.jsx` 登入頁面取得 **Token**（目前已申請完成），後續請求皆需攜帶此 Token 進行驗證。
  2. **客戶購物 API (Front)**：
     - **功能模組**：產品 (Products)、購物車 (Cart)、優惠券 (Coupon)、結帳 (Order)、付款 (Pay)、文章 (Article)。
     - **資料來源**：此處呈現的資料，皆由管理者透過 Admin API 新增、編輯後方可取得。

### ⚙️ 後端 (`./backend`)

- **技術棧**：Spring Boot。
- **目前進度**：目前為空殼專案，僅完成 `pom.xml` 的相關相依性 (Dependency) 設定。
- **最終目標**：完全仿照六角學院 API 規格實作，無縫提供給現有前端使用。
- **登入流向**：使用者透過前端 `Login.jsx` 登入後端（需在資料庫預設一組 `admin` 角色的帳密admin@gmail.com/Test123456，允許其登入），成功後進入 Dashboard 頁面操作 Admin API，最終可以產生 Front 的 API。

---

## 💡 開發策略與規劃想法

### 1. 前端調整原則

- **不改動程式碼**：前端暫時不要做任何改動，也不修正任何語法的 Bug。
- **邏輯觀察**：純粹觀察與分析現有前端呼叫六角學院 API 的請求邏輯。

### 2. 後端架構設計需求

#### 🔑 認證與授權框架 (Authentication & Authorization)

- **核心技術**：採用 **Spring Security** 結合 **JWT (JSON Web Token)**。
- **套件依賴**：使用 `io.jsonwebtoken` 套件。
- **初始化帳號**：需在資料庫 (DB) 預設一組具備 `admin` 權限的帳號，供前端登入控制。

#### 💾 ORM 與資料庫儲存設計 (Database Design)

- **設計目標**：規劃如何存儲資料。
- **核心邏輯**：確保資料能正確對應管理控制台（Admin）與客戶購物（Front）兩大區塊，滿足從 Admin 新增編輯、Front 讀取呈現的資料連動。
  請謹慎使用程式碼。

#### 💾 如有任何問題，跟我說 (Database Design)

依據本次更新內容，協助負責維護 `docs/` 目錄下的所有文件。

## 文件結構

```
docs/
├── README.md        # 技術棧、快速開始、文件索引
├── ARCHITECTURE.md  # 架構、路由表、DB Schema、資料流
├── DEVELOPMENT.md   # 開發規範、命名規則、新增功能流程
├── FEATURES.md      # 功能清單與行為描述
├── TESTING.md       # 測試規範
├── CHANGELOG.md     # 更新日誌
└── plans/           # 開發計畫（完成後移至 archive/）
```

## 工作流程

接到任務時，先確認：

1. 哪些功能/API 有新增或變更？
2. 哪些 docs/ 文件需要更新？

逐一更新對應文件：

### FEATURES.md 更新規則

- 新功能加入功能狀態總覽表，標記 ✅ 完成或 🚧 進行中
- 每個功能區塊寫詳細行為描述（不只是端點表格）：查詢參數、業務邏輯、錯誤情境

### CHANGELOG.md 更新規則

- 格式：`## [版本] - YYYY-MM-DD`，底下用 `### Added / Changed / Fixed / Removed`
- 若尚未定版，放在 `## [Unreleased]` 區塊

### ARCHITECTURE.md 更新規則

- 新增路由時同步更新路由表（頁面路由和 REST API 兩張表）
- 新增 DB 欄位時同步更新 Schema 表格

### 計畫歸檔

- 功能完成後，將 `docs/plans/YYYY-MM-DD-<feature>.md` 移至 `docs/plans/archive/`
- 使用 Bash 執行 `mv` 指令移動檔案

## 撰寫原則

- 使用繁體中文撰寫
- 文件內容以「未來的開發者」為讀者，避免過於簡短的概述
- 每次只更新確實有變更的部分，不要重寫整份文件
