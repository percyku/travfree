// E2E 的 GitHub 授權頁：後端設定的 GITHUB_OAUTH_AUTHORIZE_URL 是不存在的 github.e2e.test，
// 瀏覽器導向時由 Playwright 攔截，回一個立刻導回網站的頁面，就像使用者在 GitHub 按了「Authorize」。
// code 帶著帳號資料、redirect_uri 與 code_challenge，由 e2e/fake-github.mjs（後端換 token 的對象）解開並檢查。
export const GITHUB_AUTHORIZE_HOST = "https://github.e2e.test";

/** 後端有沒有接上假 GitHub（scripts/e2e.sh 與 CI 會設定） */
export const hasFakeGitHub = async (request) => {
  const res = await request.get("/v2/api/user/oauth/config");
  const { providers } = await res.json();
  return providers.github.enabled && providers.github.authorize_url.startsWith(GITHUB_AUTHORIZE_HOST);
};

/**
 * 攔截授權頁。回傳 { as(account) }：決定下一次授權的 GitHub 帳號（{ id, login, name, email }）。
 * 也記錄最後一次授權網址的參數，方便檢查前端送了什麼。
 */
export const fakeGitHubAuthorize = async (page) => {
  let account = null;
  const state = { lastParams: null };
  await page.route(`${GITHUB_AUTHORIZE_HOST}/**`, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    state.lastParams = params;
    const code = Buffer.from(
      JSON.stringify({
        user: account,
        redirect_uri: params.get("redirect_uri"),
        code_challenge: params.get("code_challenge"),
      }),
    ).toString("base64url");
    const back = new URL(params.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", params.get("state"));
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>GitHub（E2E）</title><script>location.replace(${JSON.stringify(back.href)})</script>`,
    });
  });
  return {
    as(next) {
      account = next;
    },
    get lastParams() {
      return state.lastParams;
    },
  };
};
