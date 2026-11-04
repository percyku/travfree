# 測試規範

## 執行方式

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test
```

不需要 Docker。測試使用 `test` profile 與 H2 記憶體資料庫的 PostgreSQL 模式，設定在 `src/test/resources/application-test.properties`。

## 契約驗證

`OpenApiContractConfig` 讓**所有** MockMvc 回應都自動對 `docs/openapi.yaml` 驗證（`swagger-request-validator-mockmvc`）。繼承 `ApiTestSupport` 的測試都會套用，不需要另外撰寫。

- 只驗證回應，不驗證請求，因為測試會刻意送出錯誤的請求來測錯誤情境。
- 失敗時會丟出 `OpenApiValidationException`，訊息會指出欄位與 schema 位置。先判斷是實作錯還是 spec 錯，不可以只為了讓測試通過而放寬 spec。
- spec 位置寫死為 `../docs/openapi.yaml`，所以要在 `backend/` 執行 `./mvnw test`。
- `HttpContractTest` 走真實 Tomcat、不經過 MockMvc，不在驗證範圍內。

要對正在執行的後端驗證，可以用 Prism 的 proxy 模式，回應不符合 spec 時，Prism 會在 header 加上 `sl-violations`：

```bash
npx prism proxy docs/openapi.yaml http://localhost:8080/v2 --port 4011 --errors
```

Prism 轉送 multipart 時會損壞檔案內容，圖片上傳要直接打後端。

## 測試策略

完整的單元測試與前後端整合測試，延後到主要功能完成後再做。在那之前，後端每個新 API 至少要有：

- 通過契約驗證的成功情境。
- 主要錯誤情境的狀態碼與訊息。

## 測試結構

整合測試為主，用 `@SpringBootTest` 啟動完整應用，走真實的 Security、JWT 與資料庫流程，不 mock service。這個專案的主要風險是 API 契約與前端不一致，單元測試抓不到這類問題。

| 測試 | 涵蓋範圍 |
|---|---|
| `AuthApiTest` | 登入、token 格式、登出撤銷、無效 token 不影響公開 API、Admin 路由權限 |
| `ProductApiTest` | 產品 CRUD、上下架連動、分頁、排序、分類、驗證訊息 |
| `ArticleApiTest` | 文章 CRUD、公開與否的連動、`content` 可見範圍、`create_at` 原值保存 |
| `CartApiTest` | 購物車、數量累加、即時計價、優惠券計算、優惠券管理 |
| `OrderApiTest` | 結帳、訂單快照、付款、Admin 更新、時間單位 |
| `UploadApiTest` | 圖片上傳與讀取、內容檢查、大小限制 |
| `HttpContractTest` | 走真實 Tomcat：`/v2` 前綴、CORS、超過上傳上限的回應 |
| `BackendApplicationTests` | 應用程式可以啟動 |
| `OpenApiContractConfig` | 不是測試，讓所有 MockMvc 回應都對 spec 驗證 |

`ApiTestSupport` 是共用基底：每個測試前清空業務資料並重新登入，也提供建立產品、加入購物車、結帳等輔助方法。

## 撰寫原則

- **以前端的實際行為為準。** 請求內容比照前端送出的格式，包含多餘欄位、字串型別的 `status`、裸 token。斷言前端實際讀取的欄位。
- **新增 API 至少涵蓋**：成功回應的欄位名稱與型別、權限、每個錯誤情境的狀態碼與訊息。
- **時間與金額要斷言單位與精確值。** 秒與毫秒搞混是這個專案最容易發生的錯誤。
- **業務規則要測連動**，例如下架後 Front 看不到、改價後訂單不變，而不只測單一端點。
- 需要真實 HTTP 行為時（CORS、multipart 上限、context-path）放進 `HttpContractTest`。MockMvc 不經過 context-path，也不會執行 Tomcat 的 multipart 上限。

## 端到端驗證

H2 無法完全代表 PostgreSQL，尤其是 `jsonb` 欄位。修改 entity 或 JSON 欄位後，請在真實環境驗證：

```bash
cd backend && docker compose up -d
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run
# 另開終端機
cd frontend && VITE_APP_API_BASE=http://localhost:8080/v2 npm run dev
```

在瀏覽器走完主要流程：

1. 以 `admin@gmail.com` 登入，進入後台。
2. 新增產品（含上傳圖片）與文章，並勾選啟用。
3. 到前台確認產品與文章出現。
4. 加入購物車、調整數量、填寫資料並送出訂單。
5. 確認成功頁的品項與總計。
6. 到後台修改訂單的付款與外送狀態，確認付款日期顯示正確。
7. 重新整理頁面，確認仍維持登入。

前端沒有 UI 的優惠券與付款，需要直接呼叫 API 驗證。

用瀏覽器自動化時要注意，Bootstrap modal 在開啟動畫結束前會忽略 `hide()`。腳本要等動畫結束再送出，否則會誤判成 modal 關不掉。
