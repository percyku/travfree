// E2E 的「假 GitHub」：後端換 token 與取得使用者資料的 API（GITHUB_TOKEN_URL、GITHUB_API_URL 指向這裡）。
// 授權頁由 Playwright 在瀏覽器端攔截（tests/github.js），不經過這裡。
//
// 不保存狀態：code 是 base64url 的 JSON，含帳號資料、當初的 redirect_uri 與 PKCE 的 code_challenge，
// 由 tests/github.js 產生。這裡依 GitHub 的行為檢查 client 帳密、redirect_uri 與 code_verifier，
// 不符時回 200 與 error 欄位（GitHub 就是這樣），所以後端的檢查與真的 GitHub 相同。
//
// 只用 Node 內建模組，在 compose 的 node 映像檔直接執行：node fake-github.mjs
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 9000);
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

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

const token = async (req, res) => {
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
  send(res, 200, {
    access_token: `gho_${Buffer.from(JSON.stringify(grant.user)).toString("base64url")}`,
    token_type: "bearer",
    scope: "user:email",
  });
};

const user = (req, res, path) => {
  const auth = req.headers.authorization ?? "";
  const account = auth.startsWith("Bearer gho_") ? decode(auth.slice("Bearer gho_".length)) : null;
  if (!account) return send(res, 401, { message: "Bad credentials" });
  if (path === "/user/emails") {
    const emails = [{ email: `${account.id}+${account.login}@users.noreply.github.com`, primary: false, verified: true }];
    if (account.email) emails.unshift({ email: account.email, primary: true, verified: true });
    return send(res, 200, emails);
  }
  send(res, 200, { id: account.id, login: account.login, name: account.name ?? null, email: null });
};

createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "POST" && path === "/login/oauth/access_token") return token(req, res);
  if (req.method === "GET" && (path === "/user" || path === "/user/emails")) return user(req, res, path);
  if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
  send(res, 404, { message: "Not Found" });
}).listen(PORT, () => console.log(`fake GitHub listening on :${PORT}`));
