// 要在 App（createHashRouter 建立時就讀取網址）之前執行，所以 main.jsx 第一個匯入它。說明見 utils/oauth.js
import { captureOAuthRedirect } from "./utils/oauth";

const callbackUrl = captureOAuthRedirect(window.location.href);
if (callbackUrl) window.history.replaceState(null, "", callbackUrl);
