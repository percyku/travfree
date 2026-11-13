// 會員：註冊 → 登出 → 再登入；一般會員進不了後台；會員中心
import { expect, test } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  MEMBER_PASSWORD,
  TOKEN_COOKIE,
  signupByApi,
  toast,
  uniqueId,
} from "./helpers.js";

test("會員註冊後是登入狀態，登出後可以再登入", async ({ page }) => {
  const id = uniqueId();
  const name = `E2E 會員 ${id}`;
  const email = `e2e-member-${id}@example.com`;
  const header = page.locator("nav").first();

  await test.step("從首頁進入註冊頁並註冊", async () => {
    await page.goto("/");
    await header.getByRole("link", { name: "註冊" }).click();
    await page.getByLabel("姓名").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("密碼", { exact: true }).fill(MEMBER_PASSWORD);
    await page.getByLabel("確認密碼").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "註冊", exact: true }).click();
  });

  await test.step("回到首頁，Header 顯示姓名", async () => {
    await expect(toast(page, `註冊成功，歡迎 ${name}`)).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await expect(header.getByText(name, { exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "後台" })).toHaveCount(0);
  });

  await test.step("重新整理後仍是登入狀態", async () => {
    await page.reload();
    await expect(header.getByText(name, { exact: true })).toBeVisible();
  });

  await test.step("登出", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(toast(page, "已登出")).toBeVisible();
    await expect(header.getByRole("link", { name: "登入" })).toBeVisible();
  });

  await test.step("以大小寫不同的 email 再登入", async () => {
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByLabel("密碼").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${name}`)).toBeVisible();
    await expect(header.getByText(name, { exact: true })).toBeVisible();
  });
});

test("一般會員進不了後台，在後台登入頁改用管理者登入", async ({ page, context, request, baseURL }) => {
  const member = await signupByApi(request);
  await context.addCookies([{ name: TOKEN_COOKIE, value: member.token, url: baseURL }]);

  await test.step("以會員身分開啟後台，被導向後台登入頁", async () => {
    await page.goto("/#/admin/products");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(
      page.getByText("目前登入的帳號沒有後台權限，請改用管理者帳號登入"),
    ).toBeVisible();
  });

  await test.step("會員帳號在後台登入頁被拒絕", async () => {
    await page.getByLabel("Email address").fill(member.email);
    await page.getByLabel("Password").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(page.getByText("此帳號沒有後台權限")).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });

  await test.step("改用管理者登入後進入後台", async () => {
    await page.getByLabel("Email address").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(page).toHaveURL(/#\/admin\/products$/);
  });
});

// 手機寬度一行只放得下一個會員連結，多了會把購物車擠到第二行、壓在首頁大圖上。
// 登入後連「會員圖示＋登出」都放不下，所以登出放在會員中心頁
test("手機寬度的 Header 不換行（訪客、管理者與會員）", async ({ browser, request, baseURL }) => {
  const res = await request.post("/v2/api/user/signin", {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const { token: adminToken } = await res.json();

  const member = await signupByApi(request);

  for (const [who, token] of [["訪客", null], ["管理者", adminToken], ["會員", member.token]]) {
    await test.step(who, async () => {
      const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
      if (token) await context.addCookies([{ name: TOKEN_COOKIE, value: token, url: baseURL }]);
      const page = await context.newPage();
      await page.goto("/");
      const header = page.locator("nav").first();
      // 登入後手機寬度只有會員中心的圖示，登出在會員中心頁
      await expect(header.getByRole("link", { name: token ? "會員中心" : "登入" })).toBeVisible();
      // 購物車圖示是 Google Fonts 的 Material Icons。字型到之前顯示的是很寬的文字「shopping_cart」，
      // 會暫時把購物車擠到第二行；CI 下載字型較慢，不等的話會量到這個瞬間
      await page.waitForFunction(() =>
        [...document.fonts].some(
          (font) => font.family.replace(/"/g, "") === "Material Icons Outlined" && font.status === "loaded",
        ),
      );

      const brand = await header.getByText("#FreeTrav").boundingBox();
      const cart = await header.getByRole("link", { name: /shopping_cart/ }).boundingBox();
      // 購物車與 logo 在同一行
      expect(Math.abs(cart.y + cart.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(brand.height);
      await context.close();
    });
  }
});

test("會員中心：填寫電話與地址後結帳自動帶入，變更密碼後以新密碼登入", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const member = await signupByApi(request);
  const newPassword = "Journey2027";
  await context.addCookies([{ name: TOKEN_COOKIE, value: member.token, url: baseURL }]);
  const header = page.locator("nav").first();

  await test.step("從 Header 進入會員中心，填寫電話與地址", async () => {
    await page.goto("/");
    await header.getByRole("link", { name: "會員中心" }).click();
    await expect(page).toHaveURL(/#\/member$/);
    await expect(page.getByLabel("Email")).toHaveValue(member.email);
    await page.getByLabel("電話").fill("0912345678");
    await page.getByLabel("地址").fill("台北市信義區市府路1號");
    await page.getByRole("button", { name: "儲存基本資料" }).click();
    await expect(toast(page, "已更新會員資料")).toBeVisible();
  });

  await test.step("重新整理後資料仍在", async () => {
    await page.reload();
    await expect(page.getByLabel("電話")).toHaveValue("0912345678");
  });

  await test.step("加入購物車後，填寫資料頁已帶入收件資料", async () => {
    const { products } = await (await request.get("/v2/api/products/all")).json();
    const product = products.find((p) => p.title === "台北3日遊");
    expect(product, "找不到產品 台北3日遊，種子資料是否已匯入？").toBeTruthy();
    await request.post("/v2/api/cart", {
      headers: { Authorization: member.token },
      data: { data: { product_id: product.id, qty: 1 } },
    });
    await page.goto("/#/cartform");
    await expect(page.getByLabel("收件人電話")).toHaveValue("0912345678");
    await expect(page.getByLabel("收件人地址")).toHaveValue("台北市信義區市府路1號");
    await expect(page.getByLabel("收件人姓名")).toHaveValue(member.name);
    await expect(page.getByLabel("Email")).toHaveValue(member.email);
  });

  await test.step("變更密碼後仍是登入狀態", async () => {
    await page.goto("/#/member");
    await page.getByLabel("目前的密碼").fill(MEMBER_PASSWORD);
    await page.getByLabel("新密碼", { exact: true }).fill(newPassword);
    await page.getByLabel("確認新密碼").fill(newPassword);
    await page.getByRole("button", { name: "變更密碼" }).click();
    await expect(toast(page, "已變更密碼")).toBeVisible();
    // 換成新的 token，重新整理後仍是登入狀態
    await page.reload();
    await expect(page.getByLabel("Email")).toHaveValue(member.email);
  });

  await test.step("舊 token 失效", async () => {
    const res = await request.get("/v2/api/user/profile", {
      headers: { Authorization: member.token },
    });
    expect(res.status()).toBe(401);
  });

  await test.step("在會員中心登出後回到首頁", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(toast(page, "已登出")).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await expect(toast(page, "請先登入會員")).toHaveCount(0);
  });

  await test.step("以新密碼登入", async () => {
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("密碼").fill(newPassword);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
    await expect(header.getByText(member.name, { exact: true })).toBeVisible();
  });
});
