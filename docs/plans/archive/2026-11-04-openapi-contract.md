# OpenAPI 契約與前後端分離開發

## 目標

讓前後端可以分開開發：`docs/openapi.yaml` 是 API 的唯一規格來源，前端只讀 spec，不需要讀後端程式碼。

## 決定

- **手寫 spec，不用 springdoc 從程式碼產生。** 流程是先改 spec 再實作，自動產生會讓規格跟著程式碼跑。
- **OpenAPI 3.0.3。** 驗證工具對 3.1 支援不完整。
- **路徑直接寫 `react-week2-api`**，不用 server 變數。前端開發者讀起來最直接；之後若改名，spec 與 `app.api-path` 一起替換。
- **自動檢查後端符合 spec。** 用 `swagger-request-validator-mockmvc` 讓所有整合測試的**回應**都對 spec 驗證。請求不驗證，因為測試會刻意送出錯誤的請求。
- **測試策略。** 完整的單元測試與前後端整合測試延後。每個新 API 至少要有契約驗證與主要錯誤情境的測試。
- **docs 只有一份**，放在根目錄。`backend/`、`frontend/` 各有自己的 `CLAUDE.md`，只寫該區專屬的規則。

## 步驟

1. ✅ `git init`，commit 現況。
2. ✅ 依 37 個端點與 `FEATURES.md` 撰寫 `docs/openapi.yaml`。
3. ✅ 根目錄 `package.json`：lint、預覽文件、mock server。
4. ✅ 後端測試加入回應契約驗證，跑全部整合測試。
5. ✅ 用正在執行的本機後端與 Hexschool 匯入資料，對 spec 再驗證一次。
6. ✅ 拆分 `CLAUDE.md`，更新 `docs/`。
