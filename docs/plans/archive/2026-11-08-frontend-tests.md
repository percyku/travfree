# 前端自動化測試

## 目標

前端目前沒有任何自動化測試。先為「登入」與「購物車 → 優惠券 → 結帳 → 付款」這兩條主要流程補上測試，並讓測試能發現前端與 `docs/openapi.yaml` 不一致的地方。

## 工具

- **Vitest + jsdom**：與 Vite 共用設定，`import.meta.env` 可以直接使用。
- **React Testing Library + user-event**：從使用者的角度操作畫面。
- **MSW（Mock Service Worker）**：在測試中攔截 axios 的請求。
  Prism mock server 不會保存狀態，回傳的假資料也是隨機的，不適合拿來測「套用優惠券後重新讀取購物車」這種流程，所以改用 MSW。

## 契約檢查

MSW 的每個 handler 都會經過契約檢查（`src/test/contract.js`），做法和後端的契約測試相同：

- **請求**：前端送出的 body 要符合 spec 的 `requestBody` schema，路徑和方法也要在 spec 裡。
- **回應**：測試假資料要符合 spec 對應狀態碼的回應 schema。

不符合時測試直接失敗。這樣既能發現前端送錯格式，也能避免測試假資料與 spec 脫節。

## 範圍

第一階段：

1. 測試基礎設施：`vitest.config`、setup、MSW server、契約檢查、render helper（Redux store + MemoryRouter）。
2. 純函式：`utils/coupon.js`、`utils/filter.js`。
3. 購物車頁：費用明細金額（`CartPriceRows`）、套用/移除優惠券（`CouponForm`）。
4. 填寫資料頁（`CartForm`）：欄位驗證、送出時帶 `final_total`、409 金額變動的提示。
5. 訂單成功頁（`CartSuccess`）：顯示付款狀態、立即付款。
6. 登入頁（`Login`）、後台路由保護（`ProductedRoute`）。

第二階段：後台產品、文章、訂單、優惠券管理頁，以及後台導覽列的登出。

## 順手修正

- `App.jsx` 用 `./components/messageToast` 匯入 `MessageToast.jsx`，大小寫不一致。macOS 不區分大小寫所以能跑，在 Linux（CI、部署）上會找不到檔案。

## 指令

```bash
cd frontend
npm test          # 執行一次
npm run test:watch
```

## 進度

- 2026-11-08：第一階段完成，6 個測試檔、52 個測試。另外修正登入失敗時沒有顯示後端原因（429 看不到「請 15 分鐘後再試」）。
- 2026-11-08：第二階段完成，後台產品、文章、訂單、優惠券管理頁與登出，共 12 個測試檔、90 個測試。順手修正文章 modal 的圖片網址與 label、產品圖片上傳失敗的提示。
