// 假的 Google Identity Services：renderButton 畫出一般的按鈕，按下時以 nextCredential 呼叫 initialize 的 callback。
// 真的 GIS 會開 Google 的視窗，測試裡無法操作。
import { api } from "./contract";
import { server } from "./server";

export const GOOGLE_CLIENT_ID = "1234567890-abc.apps.googleusercontent.com";

/** 後端已設定 Google 登入 */
export const useGoogleEnabled = () =>
  server.use(
    api.get("/api/user/google/config", () => ({
      json: { success: true, enabled: true, client_id: GOOGLE_CLIENT_ID },
    })),
  );

/**
 * 安裝假的 window.google。回傳 { setCredential, initialized }：
 * setCredential 決定下一次按下按鈕時回傳的 ID token；initialized 記錄 initialize 的參數。
 */
export const installFakeGoogle = (credential = "fake-google-id-token") => {
  let next = credential;
  const initialized = [];
  let callback = null;
  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          initialized.push(config);
          callback = config.callback;
        },
        renderButton: (element, options) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `Google ${options.text}`;
          button.addEventListener("click", () => callback({ credential: next }));
          element.replaceChildren(button);
        },
      },
    },
  };
  return {
    setCredential: (value) => {
      next = value;
    },
    initialized,
  };
};
