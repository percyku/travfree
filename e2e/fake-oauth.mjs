// E2E 的「假 GitHub」與「假 Facebook」：後端換 token 與取得使用者資料的 API
// （GITHUB_OAUTH_TOKEN_URL、GITHUB_OAUTH_API_URL、FACEBOOK_OAUTH_TOKEN_URL、FACEBOOK_OAUTH_API_URL 指向這裡）。
// 授權頁由 Playwright 在瀏覽器端攔截（tests/oauth.js），不經過這裡。
//
// 不保存狀態：code 是 base64url 的 JSON，含帳號資料、當初的 redirect_uri 與 PKCE 的 code_challenge，
// 由 tests/oauth.js 產生。這裡依各平台的行為檢查，所以後端的檢查與正式環境相同：
// - GitHub（/github/...）：client 帳密、redirect_uri、code_verifier；不符時回 200 與 error 欄位。
// - Facebook（/facebook/...）：App ID 與 Secret、redirect_uri；不符時回 400 與 error 物件；/me 要帶正確的 appsecret_proof。
//
// 只用 Node 內建模組，在 compose 的 node 映像檔直接執行：node fake-oauth.mjs
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 9000);
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = process.env;

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (value) => {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

const bearer = (req, prefix) => {
  const auth = req.headers.authorization ?? "";
  return auth.startsWith(`Bearer ${prefix}`) ? auth.slice(`Bearer ${prefix}`.length) : null;
};

// ───────── GitHub ─────────

const githubToken = async (req, res) => {
  const form = new URLSearchParams(await readBody(req));
  if (form.get("client_id") !== GITHUB_CLIENT_ID || form.get("client_secret") !== GITHUB_CLIENT_SECRET) {
    return send(res, 200, { error: "incorrect_client_credentials" });
  }
  const grant = decode(form.get("code") ?? "");
  const verifier = form.get("code_verifier");
  const challenge = verifier && createHash("sha256").update(verifier).digest("base64url");
  if (
    !grant?.user ||
    grant.redirect_uri !== form.get("redirect_uri") ||
    (grant.code_challenge && grant.code_challenge !== challenge)
  ) {
    return send(res, 200, { error: "bad_verification_code" });
  }
  // access token 直接帶著帳號資料，/user 再解開
  send(res, 200, { access_token: `gho_${encode(grant.user)}`, token_type: "bearer", scope: "user:email" });
};

const githubUser = (req, res, path) => {
  const token = bearer(req, "gho_");
  const account = token && decode(token);
  if (!account) return send(res, 401, { message: "Bad credentials" });
  if (path === "/github/user/emails") {
    const emails = [{ email: `${account.id}+${account.login}@users.noreply.github.com`, primary: false, verified: true }];
    if (account.email) emails.unshift({ email: account.email, primary: true, verified: true });
    return send(res, 200, emails);
  }
  send(res, 200, { id: account.id, login: account.login, name: account.name ?? null, email: null });
};

// ───────── Facebook ─────────

const facebookError = (res, message, code) =>
  send(res, 400, { error: { message, type: "OAuthException", code } });

const facebookToken = (res, query) => {
  if (query.get("client_id") !== FACEBOOK_APP_ID || query.get("client_secret") !== FACEBOOK_APP_SECRET) {
    return facebookError(res, "Error validating client secret.", 1);
  }
  const grant = decode(query.get("code") ?? "");
  if (!grant?.user || grant.redirect_uri !== query.get("redirect_uri")) {
    return facebookError(res, "Invalid verification code format.", 100);
  }
  send(res, 200, { access_token: `EAA${encode(grant.user)}`, token_type: "bearer", expires_in: 5183944 });
};

const facebookMe = (req, res, query) => {
  const token = bearer(req, "EAA");
  const account = token && decode(token);
  if (!account) return facebookError(res, "Invalid OAuth access token.", 190);
  const proof = createHmac("sha256", FACEBOOK_APP_SECRET ?? "").update(`EAA${token}`).digest("hex");
  if (query.get("appsecret_proof") !== proof) {
    return facebookError(res, "Invalid appsecret_proof provided in the API argument", 100);
  }
  const body = { id: account.id, name: account.name };
  // 沒有 email（手機註冊或拒絕提供）時 Facebook 不回傳這個欄位
  if (account.email && (query.get("fields") ?? "").split(",").includes("email")) body.email = account.email;
  send(res, 200, body);
};

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  if (req.method === "POST" && path === "/github/login/oauth/access_token") return githubToken(req, res);
  if (req.method === "GET" && (path === "/github/user" || path === "/github/user/emails")) {
    return githubUser(req, res, path);
  }
  if (req.method === "GET" && path === "/facebook/oauth/access_token") return facebookToken(res, url.searchParams);
  if (req.method === "GET" && path === "/facebook/me") return facebookMe(req, res, url.searchParams);
  if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
  send(res, 404, { message: "Not Found" });
}).listen(PORT, () => console.log(`fake OAuth (GitHub, Facebook) listening on :${PORT}`));
