// 後台訂單：前台下單後，後台看得到這筆訂單，並修改付款與外送狀態
import { expect, test } from "@playwright/test";
import { clearCart, loginAsAdmin, placeOrderByApi, toast, uniqueId } from "./helpers.js";

test("後台修改訂單的付款與外送狀態", async ({ page, request }) => {
  const id = uniqueId();
  const user = {
    name: `E2E 顧客 ${id}`,
    email: `e2e-${id}@example.com`,
    tel: "0912345678",
    address: "台北市信義區市府路1號",
  };
  await clearCart(request);
  const orderId = await placeOrderByApi(request, { productTitle: "東京5日遊", user });

  await loginAsAdmin(page);
  await page.getByRole("link", { name: "後台訂單列表" }).click();
  const row = page.getByRole("row").filter({ hasText: orderId });

  await test.step("訂單列表看得到這筆訂單", async () => {
    await expect(row).toContainText(user.name);
    await expect(row).toContainText(user.email);
    await expect(row).toContainText("未付款");
  });

  const dialog = page.getByRole("dialog");

  await test.step("改為已付款、外送中", async () => {
    await row.getByRole("button", { name: "查看" }).click();
    await expect(dialog.getByRole("heading", { name: `編輯 ${orderId}` })).toBeVisible();
    await expect(dialog.getByRole("cell", { name: "東京5日遊" })).toBeVisible();
    await dialog.getByLabel(/付款狀態/).check();
    await dialog.getByRole("combobox").selectOption({ label: "外送中" });
    await dialog.getByRole("button", { name: "儲存" }).click();
    await expect(toast(page, "已更新訂單資訊")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText("付款完成");
  });

  await test.step("重新開啟仍是修改後的狀態", async () => {
    await row.getByRole("button", { name: "查看" }).click();
    await expect(dialog.getByLabel(/付款狀態/)).toBeChecked();
    await expect(dialog.getByRole("combobox")).toHaveValue("2");
    await dialog.getByRole("button", { name: "關閉" }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step("前台查詢訂單也是已付款", async () => {
    const { order } = await (await request.get(`/v2/api/order/${orderId}`)).json();
    expect(order.is_paid).toBe(true);
    expect(order.status).toBe(2);
    expect(order.paid_date).toBeGreaterThan(0);
  });
});
