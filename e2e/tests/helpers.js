import { expect } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@gmail.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Test123456";

/** 每次執行都不同的標記，讓測試建立的資料不會與其他資料重複 */
export const uniqueId = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** 購物車全站共用，每個測試開始前清空 */
export const clearCart = async (request) => {
  const res = await request.delete("/v2/api/carts");
  expect(res.ok()).toBe(true);
};

/** 提示訊息（右上角的 toast） */
export const toast = (page, text) =>
  page.locator(".toast-body", { hasText: text });

/** 從登入頁登入後台，結束時停在後台產品列表 */
export const loginAsAdmin = async (page) => {
  await page.goto("/#/login");
  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登入" }).click();
  await expect(page).toHaveURL(/#\/admin\/products$/);
};

/** 透過 API 下單（加入購物車 → 結帳），回傳訂單 id。用於需要既有訂單的後台測試 */
export const placeOrderByApi = async (request, { productTitle, user }) => {
  const { products } = await (await request.get("/v2/api/products/all")).json();
  const product = products.find((p) => p.title === productTitle);
  expect(product, `找不到產品 ${productTitle}，種子資料是否已匯入？`).toBeTruthy();
  await request.post("/v2/api/cart", {
    data: { data: { product_id: product.id, qty: 1 } },
  });
  const res = await request.post("/v2/api/order", { data: { data: { user } } });
  const body = await res.json();
  expect(body.success, body.message).toBe(true);
  return body.orderId;
};
