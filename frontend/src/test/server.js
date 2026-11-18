import { setupServer } from "msw/node";
import { api } from "./contract";

/**
 * 各測試用 server.use(api.get(...)) 加上自己需要的 handler。
 * 預設只有第三方登入的設定（全部關閉）：登入、註冊與會員中心都會讀取它們。
 * 要測 Google 時以 test/google.js 的 useGoogleEnabled 覆蓋，GitHub 用 test/oauth.js 的 useGitHubEnabled
 */
const disabledProvider = { enabled: false, client_id: "", authorize_url: "", scope: "" };

export const server = setupServer(
  api.get("/api/user/google/config", () => ({
    json: { success: true, enabled: false, client_id: "" },
  })),
  api.get("/api/user/oauth/config", () => ({
    json: {
      success: true,
      providers: { github: disabledProvider, facebook: disabledProvider },
    },
  })),
);
