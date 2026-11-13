// Google 登入：新帳號、設定密碼；email 已有帳號時不自動合併，登入後連結。Google 以測試金鑰取代，見 tests/google.js
import { expect, test } from "@playwright/test";
import { MEMBER_PASSWORD, signupByApi, toast, uniqueId } from "./helpers.js";
import { clickGoogle, fakeGoogleSignin, googleToken, hasGoogleTestKey } from "./google.js";

test.skip(!hasGoogleTestKey(), "沒有 e2e/.google-test-key.pem：以 npm run e2e 執行，或先執行 scripts/google-test-key.sh");

test.beforeEach(async ({ page }) => {
  await fakeGoogleSignin(page);
});

test("用 Google 註冊，設定密碼後也能用密碼登入", async ({ page }) => {
  const id = uniqueId();
  const google = { sub: `google-${id}`, email: `e2e-google-${id}@gmail.com`, name: `Google 會員 ${id}` };
  const newPassword = "Journey2027";
  const header = page.locator("nav").first();

  await test.step("在註冊頁按 Google，建立帳號", async () => {
    await page.goto("/#/signup");
    await clickGoogle(page, page, googleToken(google));
    await expect(toast(page, `註冊成功，歡迎 ${google.name}`)).toBeVisible();
    await expect(header.getByText(google.name, { exact: true })).toBeVisible();
  });

  const methods = page.locator("section").filter({ has: page.getByRole("heading", { name: "登入方式" }) });
  const passwordCard = page.locator("section").filter({ has: page.getByRole("heading", { name: /密碼$/ }) });

  await test.step("會員中心：已連結 Google、還沒有密碼，不能解除連結", async () => {
    await header.getByRole("link", { name: "會員中心" }).click();
    await expect(methods).toContainText(`已連結（${google.email}）`);
    await expect(methods).toContainText("未設定");
    await expect(methods.getByRole("button", { name: "解除連結" })).toBeDisabled();
    await expect(passwordCard.getByRole("heading", { name: "設定密碼" })).toBeVisible();
  });

  await test.step("設定密碼：以 Google 重新驗證", async () => {
    await passwordCard.getByLabel("新密碼", { exact: true }).fill(newPassword);
    await passwordCard.getByLabel("確認新密碼").fill(newPassword);
    await clickGoogle(passwordCard, page, googleToken(google));
    await expect(toast(page, "已設定密碼")).toBeVisible();
    await expect(passwordCard.getByRole("heading", { name: "變更密碼" })).toBeVisible();
    await expect(methods.getByRole("button", { name: "解除連結" })).toBeEnabled();
  });

  await test.step("登出後用 Email 與密碼登入", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByLabel("Email").fill(google.email);
    await page.getByLabel("密碼").fill(newPassword);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${google.name}`)).toBeVisible();
  });
});

test("email 已有帳號時不自動合併，用密碼登入後連結，之後可以用 Google 登入", async ({ page, request }) => {
  const member = await signupByApi(request);
  const google = { sub: `google-${uniqueId()}`, email: member.email, name: "冒用同一個 email" };
  const header = page.locator("nav").first();

  await test.step("用 Google 登入：同一個 email 已有帳號，提示先用原本的方式登入", async () => {
    await page.goto("/#/signin");
    await clickGoogle(page, page, googleToken(google));
    await expect(page.getByRole("alert")).toHaveText(
      "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Google",
    );
    await expect(header.getByRole("link", { name: "登入" })).toBeVisible();
  });

  await test.step("用密碼登入後，在會員中心連結 Google", async () => {
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("密碼").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
    await page.goto("/#/member");
    const methods = page.locator("section").filter({ has: page.getByRole("heading", { name: "登入方式" }) });
    await clickGoogle(methods, page, googleToken(google));
    await expect(toast(page, "已連結 Google")).toBeVisible();
    await expect(methods).toContainText(`已連結（${member.email}）`);
  });

  await test.step("登出後用 Google 登入，是同一個帳號", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await clickGoogle(page, page, googleToken(google));
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
    await expect(header.getByText(member.name, { exact: true })).toBeVisible();
  });
});
