# 結帳金額一致性與優惠券移除

## 背景

顧客在填寫資料頁看到的金額，可能與送出後實際成交的金額不同：

- 後台刪除已套用的優惠券，購物車會回到原價，但前端仍顯示折扣後金額，訂單以原價成立。
- 後台修改商品售價，購物車金額即時改變，前端仍顯示舊金額。
- 後台停用或優惠券過期後，已套用的折扣仍然有效，停用不會立即生效。

另外，顧客無法移除已套用的優惠券。

## 決定（2026-11-08 與使用者確認，四項一起做）

1. **優惠券有效才算折扣**：購物車品項的優惠券只在「啟用且未過期」時有效。無效時，金額視同沒有優惠券，回應也不出現 `coupon`。購物車顯示與結帳計算使用同一套規則，所以停用與過期立即生效。品項上的引用保留，重新啟用後折扣恢復；刪除優惠券則照舊清除引用。
2. **送出訂單時比對金額**：`POST /api/order` 的 `data` 新增選填的 `final_total`，填入前端畫面上顯示的總計。與後端計算的金額不同時回 **409** `訂單金額已變動，請重新確認`，不建立訂單、不清空購物車。沒帶則不比對，相容既有呼叫方式。
3. **移除已套用的優惠券**：新增 `DELETE /api/coupon`，清除購物車所有品項的優惠券，回傳 `{ success, message: "已移除優惠券", data: { final_total } }`。購物車沒有套用時同樣回 200。
4. **前端**：
   - 進入填寫資料頁時重新讀取購物車。
   - 送出訂單時帶上 `final_total`；收到 409 時重新讀取購物車並顯示原因，讓顧客確認新金額後再送出。
   - 已套用的優惠碼旁邊加上「移除」按鈕。

## 步驟

1. `openapi.yaml`：`OrderCreateInput.final_total`、`POST /api/order` 的 409、`DELETE /api/coupon`、`LineItem.coupon` 與 `POST /api/coupon` 的說明，通過 `openapi:lint`。
2. 後端：`Coupon.isUsableAt`、`LineItemResponse.from(CartItem)`、`OrderCreateRequest.finalTotal`、`OrderService.create` 比對金額、`CartService.removeCoupon` 與 controller。
3. 測試：停用與過期後購物車不再折扣、結帳金額比對（相符、不符、沒帶）、移除優惠券，全部通過契約驗證。
4. 前端：`CartForm`、`orderSlice`、`cartSlice`、`CouponForm`。
5. 文件：`FEATURES.md`、`ARCHITECTURE.md`（路由表）、`CHANGELOG.md`。
