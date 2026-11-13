// E2E 的「假 Google」：以 scripts/google-test-key.sh 產生的私鑰簽出 Google 格式的 ID token（後端設定了對應的公鑰），
// 並把 GIS 的 script 換成假的按鈕。後端的驗證流程（簽章、aud、iss、到期）與真的相同，只是不連 Google。
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const KEY_FILE = fileURLToPath(new URL("../.google-test-key.pem", import.meta.url));
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "e2e-client.apps.googleusercontent.com";
export const hasGoogleTestKey = () => existsSync(KEY_FILE);

const base64url = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

/** Google 格式的 ID token；sub 是 Google 帳號的 ID */
export const googleToken = ({ sub, email, name, emailVerified = true }) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "RS256", typ: "JWT", kid: "e2e" });
  const payload = base64url({
    iss: "https://accounts.google.com",
    aud: GOOGLE_CLIENT_ID,
    sub,
    email,
    email_verified: emailVerified,
    name,
    iat: now,
    exp: now + 3600,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(readFileSync(KEY_FILE)).toString("base64url")}`;
};

// 假的 GIS：renderButton 畫出按鈕，按下時以 window.__e2eGoogleCredential 呼叫 initialize 的 callback
const FAKE_GSI = `
window.google = { accounts: { id: {
  initialize(config) { window.__e2eGoogleCallback = config.callback; },
  renderButton(element) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "以 Google 繼續（E2E）";
    button.onclick = () => window.__e2eGoogleCallback({ credential: window.__e2eGoogleCredential });
    element.replaceChildren(button);
  },
} } };`;

/** 攔截 GIS 的 script，換成假的按鈕 */
export const fakeGoogleSignin = (page) =>
  page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "application/javascript", body: FAKE_GSI }),
  );

/** 按下假的 Google 按鈕，以這個 token 回傳 */
export const clickGoogle = async (scope, page, credential) => {
  await page.evaluate((value) => {
    window.__e2eGoogleCredential = value;
  }, credential);
  await scope.getByRole("button", { name: "以 Google 繼續（E2E）" }).click();
};
