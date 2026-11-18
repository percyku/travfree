// GitHub、Facebook 登入（授權碼流程），規格見 docs/openapi.yaml 的 /api/user/oauth/{provider}。
//
// 1. startOAuth：產生 state（與 GitHub 的 PKCE），存在 sessionStorage，導向平台的授權頁。
// 2. 平台帶 code、state 導回網站根目錄（redirect_uri）。路由用 HashRouter，# 不能放進 redirect_uri。
// 3. main.jsx 在 render 前呼叫 captureOAuthRedirect：把 code 留在記憶體，立刻從網址移除並轉到 #/oauth/callback。
//    要立刻移除，因為 nginx 與 Vite 設了 Referrer-Policy: no-referrer-when-downgrade（Google 登入需要），
//    code 留在網址上會隨 Referer 送到外部資源。
// 4. OAuthCallback 頁以 takeOAuthResult 取回 code 與當初的 state 比對，再交給後端。
import axios from "axios";

const { VITE_APP_API_BASE } = import.meta.env;
const PENDING_KEY = "freetrav-oauth";
export const CALLBACK_HASH = "#/oauth/callback";

export const PROVIDER_NAMES = { google: "Google", github: "GitHub", facebook: "Facebook" };

/** 導向外部網址。獨立成物件，測試才能攔截（jsdom 不能真的導向） */
export const browser = {
  assign: (url) => window.location.assign(url),
};

let configPromise = null;

/** GET /api/user/oauth/config，讀取一次後快取。失敗時當成全部關閉，不擋住登入頁 */
export const loadOAuthConfig = () => {
  if (!configPromise) {
    configPromise = axios
      .get(`${VITE_APP_API_BASE}/api/user/oauth/config`)
      .then((res) => res.data.providers)
      .catch(() => {
        configPromise = null;
        return {};
      });
  }
  return configPromise;
};

/** 已啟用的平台，依後端的順序，例如 [{ provider: "github", client_id, authorize_url, scope }] */
export const enabledProviders = (providers) =>
  Object.entries(providers ?? {})
    .filter(([, config]) => config.enabled)
    .map(([provider, config]) => ({ provider, ...config }));

/** 平台導回的網址：網站根目錄（不含 query 與 #），要與平台上登記的 callback URL 相同 */
export const redirectUri = () => `${window.location.origin}${window.location.pathname}`;

const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomString = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

/** PKCE 的 S256。crypto.subtle 只在安全來源（https 或 localhost）可用，否則不用 PKCE（GitHub 允許） */
const pkce = async () => {
  if (!globalThis.crypto?.subtle) return null;
  const verifier = randomString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
};

/**
 * 導向平台的授權頁。
 * @param {{ provider: string, client_id: string, authorize_url: string, scope: string }} config
 * @param {object} options
 * @param {"signin"|"link"|"password"} options.purpose 回來後要登入、連結，還是設定密碼
 * @param {string} [options.returnTo] 登入後回到的頁面
 */
export const startOAuth = async (config, { purpose, returnTo = "/" }) => {
  const state = randomString();
  const challenge = config.provider === "github" ? await pkce() : null;
  const pending = {
    provider: config.provider,
    purpose,
    returnTo,
    state,
    redirectUri: redirectUri(),
    codeVerifier: challenge?.verifier ?? null,
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: pending.redirectUri,
    scope: config.scope,
    state,
  });
  if (challenge) {
    params.set("code_challenge", challenge.challenge);
    params.set("code_challenge_method", "S256");
  }
  browser.assign(`${config.authorize_url}?${params}`);
};

let captured = null;

/**
 * 在 render 前呼叫：網址是平台導回的（query 有 state，以及 code 或 error）時，記下並換掉網址。
 * @param {string} href 目前的網址（window.location.href）
 * @returns {string|null} 要換成的網址；不是導回時為 null
 */
export const captureOAuthRedirect = (href) => {
  const url = new URL(href);
  const params = url.searchParams;
  if (!params.has("state") || !(params.has("code") || params.has("error"))) return null;
  captured = {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
  };
  return `${url.origin}${url.pathname}${CALLBACK_HASH}`;
};

/**
 * 回呼頁使用，只能取一次（重新整理後就沒有了，code 也只能用一次）。
 * @returns {{ error: string } | { pending: object, code: string }}
 */
export const takeOAuthResult = () => {
  const result = captured;
  captured = null;
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY));
  } catch {
    pending = null;
  }
  sessionStorage.removeItem(PENDING_KEY);

  if (!result || !pending) {
    return { error: "登入流程已失效，請重新操作一次" };
  }
  const name = PROVIDER_NAMES[pending.provider] ?? pending.provider;
  // state 不符：不是這個瀏覽器發起的授權（CSRF），不送出 code
  if (result.state !== pending.state) {
    return { pending, error: `${name} 驗證失敗，請重新操作一次` };
  }
  if (result.error || !result.code) {
    return {
      pending,
      error: result.error === "access_denied" ? `已取消 ${name} 授權` : `${name} 驗證失敗，請重新操作一次`,
    };
  }
  return { pending, code: result.code };
};

/** 送給後端的 OAuthCodeInput */
export const codeInput = ({ code, pending }) => {
  const data = { code, redirect_uri: pending.redirectUri };
  if (pending.codeVerifier) data.code_verifier = pending.codeVerifier;
  return data;
};

/** 測試用：清除快取與暫存 */
export const resetOAuthCache = () => {
  configPromise = null;
  captured = null;
  sessionStorage.removeItem(PENDING_KEY);
};
