import { describe, expect, it } from "vitest";
import {
  captureOAuthRedirect,
  codeInput,
  startOAuth,
  takeOAuthResult,
} from "./oauth";
import { GITHUB_AUTHORIZE_URL, GITHUB_CLIENT_ID, interceptRedirects } from "../test/oauth";

const GITHUB = {
  provider: "github",
  enabled: true,
  client_id: GITHUB_CLIENT_ID,
  authorize_url: GITHUB_AUTHORIZE_URL,
  scope: "user:email",
};

const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** 導向授權頁並回傳授權網址 */
const start = async (options = { purpose: "signin" }) => {
  const urls = interceptRedirects();
  await startOAuth(GITHUB, options);
  return urls[0];
};

const back = (query) => captureOAuthRedirect(`${window.location.origin}/?${query}`);

describe("授權碼流程（utils/oauth）", () => {
  it("授權網址帶 client ID、網站根目錄的 redirect_uri、scope、state 與 PKCE", async () => {
    const url = await start();

    expect(`${url.origin}${url.pathname}`).toBe(GITHUB_AUTHORIZE_URL);
    expect(url.searchParams.get("client_id")).toBe(GITHUB_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/`);
    expect(url.searchParams.get("scope")).toBe("user:email");
    expect(url.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    // code_challenge 是送給後端的 code_verifier 的 SHA-256
    back(`code=abc&state=${url.searchParams.get("state")}`);
    const result = takeOAuthResult();
    const { code_verifier: verifier } = codeInput(result);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    expect(url.searchParams.get("code_challenge")).toBe(base64url(new Uint8Array(digest)));
  });

  it("每次的 state 都不同", async () => {
    const first = await start();
    const second = await start();
    expect(first.searchParams.get("state")).not.toBe(second.searchParams.get("state"));
  });

  it("只在平台導回時換掉網址，code 不留在網址上", () => {
    expect(captureOAuthRedirect(`${window.location.origin}/#/product`)).toBeNull();
    expect(captureOAuthRedirect(`${window.location.origin}/?code=abc`)).toBeNull(); // 沒有 state
    expect(back("code=abc&state=xyz")).toBe(`${window.location.origin}/#/oauth/callback`);
  });

  it("導回後取得 code、redirect_uri 與 code_verifier，只能取一次", async () => {
    const url = await start({ purpose: "link", returnTo: "/member" });
    back(`code=abc&state=${url.searchParams.get("state")}`);

    const result = takeOAuthResult();
    expect(result.pending).toMatchObject({ provider: "github", purpose: "link", returnTo: "/member" });
    expect(codeInput(result)).toEqual({
      code: "abc",
      redirect_uri: `${window.location.origin}/`,
      code_verifier: expect.stringMatching(/^[\w-]{43}$/),
    });
    expect(takeOAuthResult()).toEqual({ error: "登入流程已失效，請重新操作一次" });
  });

  it("state 不符時不使用 code", async () => {
    await start();
    back("code=abc&state=forged");

    const result = takeOAuthResult();
    expect(result.error).toBe("GitHub 驗證失敗，請重新操作一次");
    expect(result.code).toBeUndefined();
  });

  it("使用者在 GitHub 取消授權", async () => {
    const url = await start();
    back(`error=access_denied&state=${url.searchParams.get("state")}`);

    expect(takeOAuthResult().error).toBe("已取消 GitHub 授權");
  });

  it("沒有從本站發起（例如重新整理回呼頁）", () => {
    expect(takeOAuthResult()).toEqual({ error: "登入流程已失效，請重新操作一次" });
  });
});
