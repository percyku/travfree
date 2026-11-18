// Facebook 登入（授權碼流程）：新帳號、再登入；沒有 email 的 Facebook 帳號不能建立帳號，會員連結後可以登入。
// 授權頁由 Playwright 攔截，後端換 token 的對象是假的 Facebook，見 tests/oauth.js 與 e2e/fake-oauth.mjs
// 與 GitHub 共用的流程（設定密碼、email 已有帳號）在 github.spec.js 走過
import { expect, test } from "@playwright/test";
import { signupByApi, toast, uniqueId, MEMBER_PASSWORD } from "./helpers.js";
import { fakeAuthorize, hasFakeOAuth } from "./oauth.js";

test.beforeEach(async ({ request }) => {
  test.skip(!(await hasFakeOAuth(request, "facebook")), "後端沒有接上假的 Facebook：以 npm run e2e 執行");
});

const methodsCard = (page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "登入方式" }) });

test("用 Facebook 註冊，登出後再用 Facebook 登入", async ({ page }) => {
  const facebook = await fakeAuthorize(page, "facebook");
  const id = uniqueId();
  const account = { id: `1022${id}`, name: `Facebook 會員 ${id}`, email: `e2e-facebook-${id}@example.com` };
  facebook.as(account);
  const header = page.locator("nav").first();

  await test.step("在註冊頁按 Facebook，授權後建立帳號", async () => {
    await page.goto("/#/signup");
    await page.getByRole("button", { name: "使用 Facebook 註冊" }).click();
    await expect(toast(page, `註冊成功，歡迎 ${account.name}`)).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    // 要求 email 權限，不用 PKCE
    expect(facebook.lastParams.get("scope")).toBe("email");
    expect(facebook.lastParams.has("code_challenge")).toBe(false);
  });

  await test.step("會員中心顯示已連結 Facebook", async () => {
    await header.getByRole("link", { name: "會員中心" }).click();
    await expect(methodsCard(page)).toContainText(`已連結（${account.email}）`);
    await expect(methodsCard(page).getByRole("button", { name: "解除連結 Facebook" })).toBeDisabled();
  });

  await test.step("登出後用 Facebook 登入，是同一個帳號", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByRole("button", { name: "使用 Facebook 登入" }).click();
    await expect(toast(page, `歡迎回來，${account.name}`)).toBeVisible();
  });
});

test("沒有 email 的 Facebook 帳號不能註冊，會員連結後可以用它登入", async ({ page, request }) => {
  const member = await signupByApi(request);
  const facebook = await fakeAuthorize(page, "facebook");
  facebook.as({ id: `1022${uniqueId()}`, name: "手機註冊的 Facebook" }); // 沒有 email
  const header = page.locator("nav").first();

  await test.step("用 Facebook 登入：沒有 email，回登入頁顯示原因", async () => {
    await page.goto("/#/signin");
    await page.getByRole("button", { name: "使用 Facebook 登入" }).click();
    await expect(page.getByRole("alert")).toHaveText("Facebook 沒有提供 Email，請改用其他方式註冊");
  });

  await test.step("用密碼登入後在會員中心連結 Facebook", async () => {
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("密碼").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
    await page.goto("/#/member");
    await methodsCard(page).getByRole("button", { name: "連結 Facebook" }).click();
    await expect(toast(page, "已連結 Facebook")).toBeVisible();
    await expect(methodsCard(page).getByRole("button", { name: "解除連結 Facebook" })).toBeEnabled();
  });

  await test.step("登出後用 Facebook 登入，是同一個帳號", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByRole("button", { name: "使用 Facebook 登入" }).click();
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
  });
});
