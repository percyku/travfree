// 後台產品：新增並上架 → 前台看得到 → 刪除 → 前台看不到
import { expect, test } from "@playwright/test";
import { loginAsAdmin, toast, uniqueId } from "./helpers.js";

test("後台新增的產品出現在前台，刪除後消失", async ({ page }) => {
  const title = `E2E 測試行程 ${uniqueId()}`;
  const frontCard = page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: title }) });

  await test.step("後台新增產品並上架", async () => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "建立新的產品" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "新增產品" })).toBeVisible();
    await dialog.getByLabel("標題").fill(title);
    await dialog.getByLabel("分類").fill("E2E");
    await dialog.getByLabel("單位").fill("人");
    await dialog.getByLabel("原價").fill("30000");
    await dialog.getByLabel("售價").fill("25000");
    await dialog.getByLabel("產品描述").fill("E2E 測試建立的產品");
    await dialog.getByLabel("說明內容").fill("測試結束時會刪除");
    await dialog.getByLabel("是否啟用").check();
    await dialog.getByRole("button", { name: "送出" }).click();
    await expect(toast(page, "已建立產品")).toBeVisible();
    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("25000");
    await expect(row).toContainText("啟用");
  });

  await test.step("前台行程列表看得到新產品", async () => {
    await page.goto("/#/product");
    await expect(frontCard).toBeVisible();
    await expect(page.getByRole("button", { name: "E2E", exact: true }).first()).toBeVisible();
  });

  await test.step("後台刪除產品", async () => {
    await page.goto("/#/admin/products");
    const row = page.getByRole("row").filter({ hasText: title });
    await row.getByRole("button", { name: "刪除" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`確定要刪除${title}嗎?`);
    await dialog.getByRole("button", { name: "刪除" }).click();
    await expect(toast(page, "已刪除產品")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  await test.step("前台不再出現", async () => {
    await page.goto("/#/product");
    await expect(page.getByRole("button", { name: /立即探索/ }).first()).toBeVisible();
    await expect(frontCard).toHaveCount(0);
  });
});
