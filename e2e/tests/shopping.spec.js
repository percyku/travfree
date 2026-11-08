// 前台購物：搜尋 → 行程頁 → 加入購物車 → 套用優惠碼 → 填寫資料 → 送出訂單 → 付款
// 需要種子資料的「台北3日遊」（原價 50,000、售價 40,000）與優惠碼 Test50（五折）
import { expect, test } from "@playwright/test";
import { clearCart, toast } from "./helpers.js";

test.beforeEach(async ({ request }) => {
  await clearCart(request);
});

test("前台購物：套用優惠碼後結帳並付款", async ({ page }) => {
  await test.step("從首頁搜尋行程", async () => {
    await page.goto("/");
    await page.getByPlaceholder("搜尋景點、地點或城市").fill("台北");
    await page.getByRole("button", { name: "開始探索旅程" }).click();
    const card = page
      .locator(".card")
      .filter({ has: page.getByRole("heading", { name: "台北3日遊" }) });
    await card.getByRole("button", { name: /立即探索/ }).click();
  });

  await test.step("在行程頁加入購物車", async () => {
    await expect(page.getByRole("heading", { name: "台北3日遊" })).toBeVisible();
    await page.getByRole("button", { name: "立即購買" }).click();
    await expect(toast(page, "加入台北3日遊成功")).toBeVisible();
    await page.getByRole("link", { name: /shopping_cart/ }).click();
  });

  const summary = page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: "費用明細" }) });

  await test.step("購物車套用優惠碼", async () => {
    await expect(summary.getByText("NT$ 50,000")).toBeVisible(); // 原價小計
    await expect(summary.getByText("NT$ 40,000")).toBeVisible(); // 總計（售價）
    await summary.getByLabel("優惠碼").fill("Test50");
    await summary.getByRole("button", { name: "套用" }).click();
    await expect(toast(page, "已套用優惠券:Test50")).toBeVisible();
    await expect(summary.getByText(/已套用優惠碼 Test50/)).toBeVisible();
    await expect(summary.getByText("- NT$ 20,000")).toBeVisible(); // 優惠券折抵
    await expect(summary.getByText("NT$ 20,000", { exact: true })).toBeVisible(); // 總計
    await summary.getByRole("button", { name: "前往結賬" }).click();
  });

  await test.step("填寫資料並送出訂單", async () => {
    await page.getByLabel("收件人姓名").fill("E2E 測試");
    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("收件人電話").fill("0912345678");
    await page.getByLabel("收件人地址").fill("台北市信義區市府路1號");
    await page.getByLabel("留言").fill("E2E 測試訂單");
    await expect(summary.getByText("NT$ 20,000", { exact: true })).toBeVisible();
    await summary.getByRole("button", { name: "送出訂單" }).click();
    await expect(toast(page, "送出訂單成功")).toBeVisible();
    await expect(page).toHaveURL(/#\/cartsuccess\/[0-9a-f-]{36}$/);
  });

  await test.step("訂單成功頁付款", async () => {
    await expect(page.getByRole("heading", { name: "商品選購成功" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "台北3日遊" })).toBeVisible();
    await expect(page.getByText("NT$20,000")).toBeVisible(); // 總計（折扣後）
    await expect(page.getByText("未付款")).toBeVisible();
    await page.getByRole("button", { name: "立即付款" }).click();
    await expect(toast(page, "付款完成")).toBeVisible();
    await expect(page.getByText(/^已付款（/)).toBeVisible();
    await expect(page.getByRole("button", { name: "立即付款" })).toBeHidden();
  });

  await test.step("結帳後購物車已清空", async () => {
    await page.getByRole("link", { name: /shopping_cart/ }).click();
    await expect(page.getByText("購物車還沒有商品，立即逛逛！")).toBeVisible();
  });
});
