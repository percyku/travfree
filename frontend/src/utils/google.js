// Google Identity Services（GIS）：client ID 由後端的 GET /api/user/google/config 提供，只需在後端設定一處。
import axios from "axios";

const { VITE_APP_API_BASE } = import.meta.env;
const GSI_SRC = "https://accounts.google.com/gsi/client";

let configPromise = null;
let scriptPromise = null;

/** 讀取一次後快取。失敗時當成關閉，不擋住登入頁 */
export const loadGoogleConfig = () => {
  if (!configPromise) {
    configPromise = axios
      .get(`${VITE_APP_API_BASE}/api/user/google/config`)
      .then((res) => ({ enabled: res.data.enabled, clientId: res.data.client_id }))
      .catch(() => {
        configPromise = null;
        return { enabled: false, clientId: "" };
      });
  }
  return configPromise;
};

/** 載入一次 GIS 的 script；已經有 window.google（例如測試的假物件）時不載入 */
export const loadGsi = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("無法載入 Google 登入"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

/** 測試用：清除快取 */
export const resetGoogleCache = () => {
  configPromise = null;
  scriptPromise = null;
};
