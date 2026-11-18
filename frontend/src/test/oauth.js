// GitHub 等授權碼流程的測試輔助。導向授權頁以 utils/oauth.js 的 browser.assign 攔截（jsdom 不能真的導向）。
import { vi } from "vitest";
import { api } from "./contract";
import { server } from "./server";
import { browser, captureOAuthRedirect } from "../utils/oauth";

export const GITHUB_CLIENT_ID = "Ov23liAbCdEf123456";
export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const FACEBOOK_APP_ID = "1234567890123456";
export const FACEBOOK_AUTHORIZE_URL = "https://www.facebook.com/v27.0/dialog/oauth";

const disabled = { enabled: false, client_id: "", authorize_url: "", scope: "" };
const configs = {
  github: {
    enabled: true,
    client_id: GITHUB_CLIENT_ID,
    authorize_url: GITHUB_AUTHORIZE_URL,
    scope: "user:email",
  },
  facebook: {
    enabled: true,
    client_id: FACEBOOK_APP_ID,
    authorize_url: FACEBOOK_AUTHORIZE_URL,
    scope: "email",
  },
};

/** 後端已設定這些平台（例如 ["github", "facebook"]），其他的關閉 */
export const useOAuthEnabled = (providers) =>
  server.use(
    api.get("/api/user/oauth/config", () => ({
      json: {
        success: true,
        providers: Object.fromEntries(
          Object.keys(configs).map((p) => [p, providers.includes(p) ? configs[p] : disabled]),
        ),
      },
    })),
  );

/** 後端已設定 GitHub 登入 */
export const useGitHubEnabled = () => useOAuthEnabled(["github"]);

/** 後端已設定 Facebook 登入 */
export const useFacebookEnabled = () => useOAuthEnabled(["facebook"]);

/** 攔截導向授權頁，回傳被呼叫的網址清單（URL 物件） */
export const interceptRedirects = () => {
  const urls = [];
  vi.spyOn(browser, "assign").mockImplementation((url) => urls.push(new URL(url)));
  return urls;
};

/**
 * 模擬平台授權後導回：以 interceptRedirects 拿到的授權網址的 state，帶上 code（或 error）回到網站，
 * 與 main.jsx 相同地交給 captureOAuthRedirect
 */
export const returnFromProvider = (authorizeUrl, { code = "github-code", error, state } = {}) => {
  const params = new URLSearchParams({ state: state ?? authorizeUrl.searchParams.get("state") });
  if (error) params.set("error", error);
  else params.set("code", code);
  return captureOAuthRedirect(`${window.location.origin}/?${params}`);
};
