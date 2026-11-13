// 後台會員：管理者把會員設為管理者 → 會員進得了後台、看到自己的訂單不能修改 → 移除後進不了後台
import { expect, test } from "@playwright/test";
import { TOKEN_COOKIE, loginAsAdmin, signupByApi, toast } from "./helpers.js";

test("設定與移除管理者；管理者不能修改自己的訂單", async ({ page, browser, request, baseURL }) => {
  const member = await signupByApi(request);

  // 會員先下一筆訂單（會員有 USER，升級後也一樣可以結帳）
  const { products } = await (await request.get("/v2/api/products/all")).json();
  const product = products.find((p) => p.title === "台北3日遊");
  expect(product, "找不到產品 台北3日遊，種子資料是否已匯入？").toBeTruthy();
  const headers = { Authorization: member.token };
  await request.post("/v2/api/cart", { headers, data: { data: { product_id: product.id, qty: 1 } } });
  const recipient = { name: member.name, email: member.email, tel: "0912345678", address: "台北市" };
  const res = await request.post("/v2/api/order", { headers, data: { data: { user: recipient } } });
  const { orderId } = await res.json();
  expect(orderId).toBeTruthy();

  // 會員的瀏覽器
  const memberContext = await browser.newContext();
  await memberContext.addCookies([{ name: TOKEN_COOKIE, value: member.token, url: baseURL }]);
  const memberPage = await memberContext.newPage();

  await loginAsAdmin(page);
  await page.getByRole("link", { name: "會員列表" }).click();
  const memberRow = page.getByRole("row").filter({ hasText: member.email });
  // 角色欄（第 3 欄）。整列有「設為管理者」按鈕，不能用整列的文字判斷
  const memberRoles = memberRow.getByRole("cell").nth(2);
  const dialog = page.getByRole("dialog");

  await test.step("搜尋會員並設為管理者", async () => {
    await page.getByRole("searchbox", { name: "搜尋會員" }).fill(member.email);
    await page.getByRole("button", { name: "搜尋" }).click();
    await expect(page.getByRole("row")).toHaveCount(2); // 標題列 + 這位會員
    await expect(memberRow).toContainText(member.name);
    await memberRow.getByRole("button", { name: /設為管理者/ }).click();
    await dialog.getByRole("button", { name: "確定設為管理者" }).click();
    await expect(toast(page, "已更新會員權限")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(memberRoles).toHaveText("會員管理者");
  });

  await test.step("會員不用重新登入就能進入後台，自己的訂單不能修改", async () => {
    await memberPage.goto("/#/admin/orders");
    const ownRow = memberPage.getByRole("row").filter({ hasText: orderId });
    await expect(ownRow).toContainText("自己的訂單");
    await ownRow.getByRole("button", { name: "查看" }).click();
    const ownDialog = memberPage.getByRole("dialog");
    await expect(ownDialog.getByRole("alert")).toContainText("這是你自己下的訂單");
    await expect(ownDialog.getByLabel(/付款狀態/)).toBeDisabled();
    await expect(ownDialog.getByRole("button", { name: "儲存" })).toHaveCount(0);
    await ownDialog.getByRole("button", { name: "關閉" }).click();
    await expect(ownDialog).toBeHidden();
  });

  await test.step("自己的管理者權限不能移除", async () => {
    await memberPage.getByRole("link", { name: "會員列表" }).click();
    await memberPage.getByRole("searchbox", { name: "搜尋會員" }).fill(member.email);
    await memberPage.getByRole("button", { name: "搜尋" }).click();
    const selfRow = memberPage.getByRole("row").filter({ hasText: member.email });
    await expect(selfRow.getByRole("button", { name: /移除/ })).toBeDisabled();
  });

  await test.step("管理者移除後，會員進不了後台", async () => {
    await memberRow.getByRole("button", { name: /移除/ }).click();
    await dialog.getByRole("button", { name: "確定移除管理者" }).click();
    await expect(toast(page, "已更新會員權限")).toBeVisible();
    await expect(memberRoles).toHaveText("會員");

    await memberPage.goto("/#/admin/orders");
    await memberPage.reload();
    await expect(memberPage).toHaveURL(/#\/login$/);
    await expect(
      memberPage.getByText("目前登入的帳號沒有後台權限，請改用管理者帳號登入"),
    ).toBeVisible();
  });

  await memberContext.close();
});
