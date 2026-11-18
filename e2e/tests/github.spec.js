// GitHub 登入（授權碼流程）：新帳號、設定密碼、再登入；email 已有帳號時不自動合併，登入後連結。
// 授權頁由 Playwright 攔截，後端換 token 的對象是假的 GitHub，見 tests/oauth.js 與 e2e/fake-oauth.mjs
import { expect, test } from "@playwright/test";
import { MEMBER_PASSWORD, signupByApi, toast, uniqueId } from "./helpers.js";
import { fakeAuthorize, hasFakeOAuth } from "./oauth.js";

test.beforeEach(async ({ request }) => {
  test.skip(!(await hasFakeOAuth(request, "github")), "後端沒有接上假的 GitHub：以 npm run e2e 執行");
});

const methodsCard = (page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "登入方式" }) });
const passwordCard = (page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: /密碼$/ }) });

test("用 GitHub 註冊，以 GitHub 驗證後設定密碼，之後兩種方式都能登入", async ({ page }) => {
  const github = await fakeAuthorize(page, "github");
  const id = Number(uniqueId());
  const account = { id, login: `e2e-${id}`, name: `GitHub 會員 ${id}`, email: `e2e-github-${id}@example.com` };
  github.as(account);
  const header = page.locator("nav").first();
  const newPassword = "Journey2027";

  await test.step("在註冊頁按 GitHub，授權後建立帳號並回到首頁", async () => {
    await page.goto("/#/signup");
    await page.getByRole("button", { name: "使用 GitHub 註冊" }).click();
    await expect(toast(page, `註冊成功，歡迎 ${account.name}`)).toBeVisible();
    await expect(header.getByText(account.name, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    // 送出 PKCE；code 不留在網址上
    expect(github.lastParams.get("code_challenge_method")).toBe("S256");
    expect(page.url()).not.toContain("code=");
  });

  await test.step("會員中心：已連結 GitHub、沒有密碼，不能解除連結", async () => {
    await header.getByRole("link", { name: "會員中心" }).click();
    await expect(methodsCard(page)).toContainText(`已連結（${account.email}）`);
    await expect(methodsCard(page).getByRole("button", { name: "解除連結 GitHub" })).toBeDisabled();
    await expect(passwordCard(page).getByRole("heading", { name: "設定密碼" })).toBeVisible();
  });

  await test.step("設定密碼：先以 GitHub 驗證，回到會員中心後填寫新密碼", async () => {
    await passwordCard(page).getByRole("button", { name: "以 GitHub 驗證身分" }).click();
    await expect(passwordCard(page)).toContainText("已通過 GitHub 驗證");
    await passwordCard(page).getByLabel("新密碼", { exact: true }).fill(newPassword);
    await passwordCard(page).getByLabel("確認新密碼").fill(newPassword);
    await passwordCard(page).getByRole("button", { name: "設定密碼" }).click();
    await expect(toast(page, "已設定密碼")).toBeVisible();
    await expect(passwordCard(page).getByRole("heading", { name: "變更密碼" })).toBeVisible();
    await expect(methodsCard(page).getByRole("button", { name: "解除連結 GitHub" })).toBeEnabled();
  });

  await test.step("登出後用 GitHub 登入，是同一個帳號", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByRole("button", { name: "使用 GitHub 登入" }).click();
    await expect(toast(page, `歡迎回來，${account.name}`)).toBeVisible();
  });

  await test.step("登出後用 Email 與密碼登入", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("密碼").fill(newPassword);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${account.name}`)).toBeVisible();
  });
});

test("email 已有帳號時不自動合併，用密碼登入後連結 GitHub，之後可以用 GitHub 登入", async ({ page, request }) => {
  const member = await signupByApi(request);
  const github = await fakeAuthorize(page, "github");
  const id = Number(uniqueId());
  github.as({ id, login: `e2e-${id}`, name: "同一個 email", email: member.email });
  const header = page.locator("nav").first();

  await test.step("用 GitHub 登入：同一個 email 已有帳號，回登入頁提示先用原本的方式登入", async () => {
    await page.goto("/#/signin");
    await page.getByRole("button", { name: "使用 GitHub 登入" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 GitHub",
    );
    await expect(page).toHaveURL(/#\/signin$/);
    await expect(header.getByRole("link", { name: "登入" })).toBeVisible();
  });

  await test.step("用密碼登入後，在會員中心連結 GitHub", async () => {
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("密碼").fill(MEMBER_PASSWORD);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
    await page.goto("/#/member");
    await methodsCard(page).getByRole("button", { name: "連結 GitHub" }).click();
    await expect(toast(page, "已連結 GitHub")).toBeVisible();
    await expect(page).toHaveURL(/#\/member$/);
    await expect(methodsCard(page)).toContainText(`已連結（${member.email}）`);
  });

  await test.step("登出後用 GitHub 登入，是同一個帳號", async () => {
    await header.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await header.getByRole("link", { name: "登入" }).click();
    await page.getByRole("button", { name: "使用 GitHub 登入" }).click();
    await expect(toast(page, `歡迎回來，${member.name}`)).toBeVisible();
    await expect(header.getByText(member.name, { exact: true })).toBeVisible();
  });
});
