import { setupServer } from "msw/node";
import { api } from "./contract";

/**
 * 各測試用 server.use(api.get(...)) 加上自己需要的 handler。
 * 預設只有 Google 登入的設定（關閉）：登入、註冊與會員中心都會讀取它，要測 Google 時以 test/google.js 的 useGoogleEnabled 覆蓋
 */
export const server = setupServer(
  api.get("/api/user/google/config", () => ({
    json: { success: true, enabled: false, client_id: "" },
  })),
);
