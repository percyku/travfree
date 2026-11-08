# 開發規範

## 環境

- JDK 21。`pom.xml` 的 `java.version` 是 21，系統預設若是更新的 JDK，請指定 `JAVA_HOME=$(/usr/libexec/java_home -v 21)`。
- Maven 用專案內的 `./mvnw`，不需另外安裝。
- PostgreSQL 由根目錄的 `docker-compose.yml` 提供，開發時在根目錄執行 `docker compose up -d db` 只啟動資料庫。`docker compose down -v` 會連資料一起刪除，適合重置環境；重新啟動後端會再建立預設 admin。前後端與資料庫一起啟動見 [README.md](README.md#docker)。

## 前端開發

2026-11-08 起進入前端開發，規則見 `frontend/CLAUDE.md`。前端只依 `openapi.yaml` 開發，已發現的前端問題記錄在 [ARCHITECTURE.md](ARCHITECTURE.md) 的已知限制，修正後從清單移除。

## API 契約

`docs/openapi.yaml` 是前後端唯一的 API 規格，流程是**先改 spec，再實作**：

- 後端的整合測試會驗證每個回應都符合 spec（見 [TESTING.md](TESTING.md)）。
- 前端只依 spec 開發，後端未完成的 API 可先接 `npm run openapi:mock`。
- 回應 schema 標 `additionalProperties: false`，後端多回傳的欄位也要先寫進 spec。
- spec 是手寫的，不從程式碼自動產生，否則規格會變成跟著實作走。

## API 相容性

這個後端的主要目標是讓現有前端無縫運作，所以 API 的欄位名稱與格式不能憑慣例調整：

- **欄位命名混用 snake_case 與 camelCase**（`origin_price`、`imageUrl`、`isPublic`），這是 Hexschool 的原樣。Java 名稱與 JSON 不同的欄位都用 `@JsonProperty` 明確指定，不要設定全域的命名策略。
- **時間單位不一致**：訂單與優惠券是 Unix 秒，登入的 `expired` 是毫秒，文章 `create_at` 原值保存。新增時間欄位前，先確認前端的讀法。
- **修改回應前先看前端怎麼讀**，判斷順序見 [ARCHITECTURE.md](ARCHITECTURE.md) 的相容性原則。Swagger 有數處與實際不符。

## 命名規則

| 類型 | 規則 | 範例 |
|---|---|---|
| Entity | 單數名詞 | `Product`、`CartItem` |
| 資料表 | 複數 snake_case | `products`、`cart_items` |
| 請求 DTO | `<名稱>Request` | `ProductRequest` |
| 回應 DTO | `<名稱>Response` | `ProductResponse` |
| Controller | `Admin<名稱>Controller`、`Front<名稱>Controller` | `AdminProductController` |
| 測試 | `<模組>ApiTest` | `CartApiTest` |

## 程式慣例

- Java 用 tab 縮排，與 Spring Initializr 產生的檔案一致。
- 沒有 Lombok，entity 手寫 getter，DTO 用 record。
- Controller 只負責接收與組回應，業務規則放在 service。
- 業務錯誤丟 `ApiException`（`ApiException.badRequest(...)`、`ApiException.notFound(...)`），由 `GlobalExceptionHandler` 轉成 `{ success: false, message }`。Controller 不自行組錯誤回應。
- 回應用 `ApiResponses` 組裝。回應的 key 依端點而異，所以不為每支 API 另寫外層 record。
- Service 類別標 `@Transactional(readOnly = true)`，寫入方法再標 `@Transactional`。`open-in-view` 已關閉，lazy 關聯必須在 service 內讀取完，controller 拿到的應該是 DTO。
- 訊息與註解使用繁體中文。註解只寫程式碼看不出來的原因，例如為了相容前端的特殊處理。

## 新增功能流程

以新增一個 Admin 資源為例：

1. **寫規格**：先更新 `docs/openapi.yaml`，在根目錄執行 `npm run openapi:lint`。修改既有 API 時，先看前端的呼叫方式與讀取欄位，再對照 Hexschool。
2. **Entity**：在 `entity/` 新增，繼承 `BaseEntity`，資料表用複數 snake_case。
3. **Repository**：在 `repository/` 新增。
4. **DTO**：Request 加上驗證註解，訊息比照 `xxx 屬性不得為空`；Response 用 `@JsonProperty` 指定欄位名，並標 `@JsonInclude(NON_NULL)`。
5. **Service**：分頁用 `PagedResult.fetch(...)`，找不到資料丟 `ApiException.notFound(...)`。
6. **Controller**：Admin 路由用 `@RequestMapping("/api/admin")`，Front 路由用 `@RequestMapping("/api")`，寫入參數用 `@Valid @RequestBody DataRequest<T>`。
7. **權限**：`/api/*/admin/**` 自動要求 admin。公開路由若需要登入，要在 `SecurityConfig` 加規則，放在 `/api/**` permitAll **之前**，因為規則依序比對。
8. **測試**：見 [TESTING.md](TESTING.md)。測試會自動驗證回應符合 spec；新的權限規則也要有測試。
9. **文件**：更新 `FEATURES.md`（狀態表與行為描述）、`ARCHITECTURE.md`（路由表、Schema）、`CHANGELOG.md`。

## 文件維護

- 文件使用繁體中文，以未來的開發者為讀者。
- 每次只更新有變更的部分，不重寫整份文件。
- 開發計畫放 `docs/plans/YYYY-MM-DD-<feature>.md`，完成後用 `mv` 移到 `docs/plans/archive/`。
- `FEATURES.md`：新功能加入狀態表，標記 ✅ 完成或 🚧 進行中，並寫明查詢參數、業務邏輯與錯誤情境。
- `CHANGELOG.md`：格式為 `## [版本] - YYYY-MM-DD`，底下用 `### Added / Changed / Fixed / Removed`；未定版放 `## [Unreleased]`。
- `ARCHITECTURE.md`：新增路由時同步更新頁面路由與 REST API 兩張表，新增欄位時同步更新 Schema。
