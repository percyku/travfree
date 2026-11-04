# 功能清單

## 功能狀態總覽

| 功能 | 狀態 | 前端有串接 | 備註 |
|---|---|---|---|
| 管理者登入／驗證 | ✅ 完成 | ✓ | JWT |
| 管理者登出 | ✅ 完成 | | 前端只清 cookie，未呼叫 API |
| 預設 admin 帳號 | ✅ 完成 | ✓ | 啟動時建立 |
| 產品管理（Admin） | ✅ 完成 | ✓ | |
| 圖片上傳 | ✅ 完成 | ✓ | 存本機磁碟 |
| 文章管理（Admin） | ✅ 完成 | ✓ | |
| 訂單管理（Admin） | ✅ 完成 | ✓ | 前端未使用刪除 |
| 優惠券管理（Admin） | ✅ 完成 | | 前端沒有 UI |
| 產品瀏覽（Front） | ✅ 完成 | ✓ | |
| 文章瀏覽（Front） | ✅ 完成 | ✓ | |
| 購物車 | ✅ 完成 | ✓ | 全站共用 |
| 套用優惠券（Front） | ✅ 完成 | | 前端沒有 UI |
| 結帳 | ✅ 完成 | ✓ | |
| 付款 | ✅ 完成 | | 前端沒有 UI，只標記狀態，未串接金流 |

## 共通規則

**回應格式。** 成功時含 `success: true`，失敗時一律是 `{ "success": false, "message": "..." }`，包含 401、403、404、405、JSON 解析失敗、檔案過大與 500。

**寫入格式。** 除了登入，寫入 API 的內容都包在 `{ "data": { ... } }` 裡。少了 `data` 回 400 `data 屬性不得為空`。多傳的欄位（前端會傳 `id`、`num`）一律忽略。

**分頁。** 查詢參數 `page`，每頁 10 筆，新到舊排序。

```json
{
  "pagination": {
    "total_pages": 3,
    "current_page": 1,
    "has_pre": false,
    "has_next": true,
    "category": ""
  }
}
```

- `page` 缺少、不是數字或小於 1 時視為第 1 頁。
- `page` 超過末頁時回傳最後一頁，不是空陣列。
- 沒有資料時 `total_pages` 與 `current_page` 都是 0，與 Hexschool 實際回應相同（2026-11-04 對照確認）。
- 清單中每筆的 `num` 是它在整份清單中的名次，從 1 開始，不是固定編號。

**驗證訊息。** 必填欄位缺少時回 400，例如 `title 屬性不得為空`；多個欄位錯誤時以「、」串接。

**金額。** 都是整數，傳小數回 400 `資料格式不正確`。

## 認證

### 登入 `POST /v2/admin/signin`

Body 為 `{ "username": "...", "password": "..." }`，不包 `data`。

成功回傳 `{ success, message, uid, token, expired }`。`expired` 是**毫秒**時間戳，前端直接用來設定 cookie 期限。token 有效期預設 7 天，由 `app.jwt.ttl` 設定。

| 情境 | 回應 |
|---|---|
| 帳號不存在或密碼錯誤 | 400 `登入失敗`，不透露是哪一項錯誤 |
| 欄位空白 | 400 `username 屬性不得為空` 等 |

### 驗證 `POST /v2/api/user/check`

帶有效 token 回 `{ success: true, uid }`，否則回 401 `驗證錯誤, 請重新登入`。

`Authorization` 接受裸 token 與 `Bearer <token>` 兩種格式。

### 登出 `POST /v2/logout`

帶有效 token 時遞增該帳號的 `token_version`，**該帳號所有既有 token 立即失效**。沒帶 token 或 token 無效也回 200，方便重複呼叫。

### 預設 admin

`AdminSeeder` 在每次啟動時檢查 `app.admin.email` 是否存在，不存在才建立。帳號已存在時不會變動，所以修改 `ADMIN_PASSWORD` 不會更新既有帳號的密碼。

## 產品

### Admin

- `GET ~/admin/products`：查詢參數 `page`、`category`。包含未上架產品，`products` 是陣列。
- `GET ~/admin/products/all`：不分頁，`products` 是以 id 為 key 的物件，舊到新。
- `POST ~/admin/product`：回傳 `已建立產品`。
- `PUT ~/admin/product/{id}`：整筆覆寫，回傳 `已更新產品`。
- `DELETE ~/admin/product/{id}`：同時移除購物車內的該產品。歷史訂單有快照，不受影響。

欄位：`title`、`category`、`unit`、`origin_price`、`price` 必填；`is_enabled` 只接受 0 或 1，未傳視為 0；`imagesUrl` 必須是陣列，未傳視為空陣列。

| 情境 | 回應 |
|---|---|
| 必填欄位缺少 | 400 `title 屬性不得為空` 等 |
| 價格小於 0 | 400 `price 不得小於 0` |
| 更新時 id 不存在 | 404 `id 不存在` |
| 刪除時 id 不存在 | 404 `找不到產品` |

### Front

只回傳 `is_enabled = 1` 的產品。

- `GET ~/products`：查詢參數 `page`、`category`。`category` 未傳時前端用 `all` 代表全部，但實際不會送出。查詢的分類會出現在 `pagination.category`。
- `GET ~/products/all`：不分頁，舊到新，不含 `num`。前端用來計算分類清單與搜尋。
- `GET ~/product/{id}`：不存在或已下架都回 404 `找不到產品`。

## 圖片上傳 `POST ~/admin/upload`

`multipart/form-data`，欄位名稱是 `file-to-upload`。成功回傳 `{ success: true, imageUrl }`。

檢查規則：

- 副檔名必須是 jpg、jpeg 或 png，不分大小寫。
- 檔案開頭的 magic bytes 必須與副檔名相符，改副檔名的檔案會被拒絕。
- 大小不得超過 3MB。
- 存檔時以 UUID 重新命名，不使用原始檔名。

| 情境 | 回應 |
|---|---|
| 格式不符、空檔案、欄位名稱錯誤 | 400 `檔案格式錯誤` |
| 超過 3MB | 400 `檔案大小不得超過 3MB` |

`imageUrl` 開頭由 `app.public-base-url` 決定。部署時要設成對外網址，否則前端拿到的是 localhost 網址。

## 文章

### Admin

- `GET ~/admin/articles`：查詢參數 `page`，排序依 `create_at` 新到舊，**包含 `content`**（Hexschool 不含，原因見 [ARCHITECTURE.md](ARCHITECTURE.md)）。
- `GET ~/admin/article/{id}`：不存在回 404 `找不到文章`。
- `POST ~/admin/article`、`PUT ~/admin/article/{id}`：回傳 `已建立文章`、`已更新文章`。
- `DELETE ~/admin/article/{id}`：不存在回 404 `找不到文章`。

欄位：`title`、`description`、`author`、`content` 必填；`image`、`tag`、`isPublic` 選填。

`create_at` 原值保存，**不換算單位**。前端傳 `Date.now()`（毫秒）並以 `new Date(create_at)` 顯示。新增時未傳則用目前毫秒，更新時未傳則保留原值。

### Front

只回傳 `isPublic = true` 的文章。

- `GET ~/articles`：清單**不含 `content`**。
- `GET ~/article/{id}`：回傳 `{ success, article }`，含 `content`。不存在或未公開回 404 `找不到文章`。

## 購物車

全站共用一台，見 [ARCHITECTURE.md](ARCHITECTURE.md) 的已知限制。

- `GET ~/cart`：回傳 `{ success, data: { carts, total, final_total }, messages: [] }`。
- `POST ~/cart`：Body 的 `data` 含 `product_id`、`qty`。同一產品重複加入時**累加數量**，因為前端以 `product.id` 當 React key，每個產品只能有一列。回傳的 `data.product.title` 用於前端提示訊息。
- `PUT ~/cart/{id}`：直接設定數量，回傳 `{ data: { product_id, qty } }`。
- `DELETE ~/cart/{id}`：刪除單一品項。
- `DELETE ~/carts`：清空。

`total` 是原價小計，`final_total` 是折扣後小計，都依**目前售價**即時計算，所以改價後購物車金額會跟著變。

| 情境 | 回應 |
|---|---|
| 產品不存在 | 404 `找不到產品` |
| 產品已下架 | 400 `產品已下架` |
| `qty` 小於 1 | 400 `qty 不得小於 1` |
| `qty` 或累加後超過 9999 | 400 `qty 不得大於 9999` |
| 品項不存在 | 404 `找不到購物車品項` |
| `PUT` 的 `product_id` 與品項不符 | 400 `product_id 與購物車品項不符` |

## 優惠券

### Admin

- `GET ~/admin/coupons`：查詢參數 `page`。
- `POST ~/admin/coupon`、`PUT ~/admin/coupon/{id}`：回傳 `已建立優惠券`、`已更新優惠券`。
- `DELETE ~/admin/coupon/{id}`：同時清除購物車對它的引用，購物車回到原價。歷史訂單有快照，不受影響。

欄位：`title`、`code`、`percent`、`due_date` 必填。`percent` 是**實付比例**，80 代表付 80%。`due_date` 是 Unix **秒**。

| 情境 | 回應 |
|---|---|
| `code` 重複 | 400 `code 已存在` |
| `percent` 不在 0–100 | 400 `percent 必須介於 0 到 100` |
| 更新時 id 不存在 | 404 `id 不存在` |
| 刪除時 id 不存在 | 404 `找不到優惠券` |

### 套用 `POST ~/coupon`

Body 的 `data` 含 `code`，成功回傳 `已套用優惠券:<code>` 與 `data.final_total`。

- 只套用在**目前購物車內**的品項，之後才加入的品項不帶優惠（與 Hexschool 相同）。
- 每個品項的 `final_total = round(total × percent ÷ 100)`，四捨五入到整數。購物車總額是各品項相加。
- 只在套用時檢查到期日。已套用的優惠券在結帳時不會重新檢查。

| 情境 | 回應 |
|---|---|
| 找不到或已停用 | 404 `找不到優惠券` |
| 已過期 | 400 `優惠券已過期` |
| 購物車是空的 | 400 `購物車無資料` |

## 訂單

### 建立 `POST ~/order`

Body 的 `data` 含 `user`（`name`、`email`、`tel`、`address` 皆必填）與選填的 `message`。

在單一交易內建立訂單、寫入品項快照並清空購物車。成功回傳 `{ success, message, total, create_at, orderId }`。`total` 是**折扣後總額**，`create_at` 是 Unix **秒**。

| 情境 | 回應 |
|---|---|
| 購物車是空的 | 400 `購物車無資料` |
| 購物車含已下架產品 | 400 `購物車內有已下架產品` |
| 缺少 `user` | 400 `user 屬性不得為空` |
| Email 格式錯誤 | 400 `email 格式不正確` |

### 查詢

- `GET ~/order/{id}`：公開。找不到時回 **200** `{ success: true, order: null }`，與 Hexschool 相同。
- `GET ~/orders`、`GET ~/admin/orders`：需要 admin，查詢參數 `page`。

訂單的 `products` 是**以品項 id 為 key 的物件**，前端用 `Object.values` 讀取。未付款時回應不含 `paid_date`。

### 付款 `POST ~/pay/{id}`

設定 `is_paid = true` 與 `paid_date`（Unix **秒**），只標記狀態，沒有串接金流。

| 情境 | 回應 |
|---|---|
| 訂單不存在 | 404 `找不到訂單` |
| 已付款 | 400 `訂單已付款` |

### Admin 更新 `PUT ~/admin/order/{id}`

前端會把整筆訂單傳回來，但**只有 `is_paid` 與 `status` 會生效**，其餘欄位忽略，避免竄改金額或品項。

- `status` 來自 `<select>`，是字串（`"2"`），會自動轉成整數。必須是 0–3。
- `is_paid` 由 false 改為 true 時，伺服器寫入 `paid_date`；改回 false 時清除。已付款的訂單重複送 true 不會改變付款時間。

| 情境 | 回應 |
|---|---|
| 訂單不存在 | 404 `找不到訂單` |
| `status` 超出範圍 | 400 `status 必須介於 0 到 3` |

### Admin 刪除

- `DELETE ~/admin/order/{id}`：不存在回 404 `找不到訂單`。
- `DELETE ~/admin/orders/all`：刪除全部訂單。
