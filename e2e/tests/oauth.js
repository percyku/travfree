// E2E 的 GitHub、Facebook 授權頁：後端設定的授權網址是不存在的 github.e2e.test、facebook.e2e.test，
// 瀏覽器導向時由 Playwright 攔截，回一個立刻導回網站的頁面，就像使用者在平台上按了「授權」。
// code 帶著帳號資料、redirect_uri 與 code_challenge，由 e2e/fake-oauth.mjs（後端換 token 的對象）解開並檢查。
export const AUTHORIZE_HOSTS = {
  github: "https://github.e2e.test",
  facebook: "https://facebook.e2e.test",
};

/** 後端有沒有把這個平台接上假的服務（scripts/e2e.sh 與 CI 會設定） */
export const hasFakeOAuth = async (request, provider) => {
  const res = await request.get("/v2/api/user/oauth/config");
  const config = (await res.json()).providers[provider];
  return config.enabled && config.authorize_url.startsWith(AUTHORIZE_HOSTS[provider]);
};

/**
 * 攔截這個平台的授權頁。回傳 { as(account) }：決定下一次授權的帳號
 * （GitHub：{ id, login, name, email }；Facebook：{ id, name, email }，email 可以省略）。
 * 也記錄最後一次授權網址的參數（lastParams），方便檢查前端送了什麼。
 */
export const fakeAuthorize = async (page, provider) => {
  let account = null;
  const state = { lastParams: null };
  await page.route(`${AUTHORIZE_HOSTS[provider]}/**`, async (route) => {
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
      body: `<!doctype html><title>${provider}（E2E）</title><script>location.replace(${JSON.stringify(back.href)})</script>`,
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
