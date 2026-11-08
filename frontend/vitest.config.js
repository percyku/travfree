import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.js"],
      // 固定測試用的環境變數，不受 .env.local 影響
      env: {
        VITE_APP_API_BASE: "http://api.test/v2",
        VITE_APP_API_COOKIE_PATH: "/",
        VITE_APP_TOKEN_NAME: "freetrav-token",
        TZ: "Asia/Taipei",
        // 前後端共用的 API 契約，src/test/contract.js 依此檢查請求與回應
        OPENAPI_SPEC: fileURLToPath(
          new URL("../docs/openapi.yaml", import.meta.url),
        ),
      },
      css: false,
      // Node 下 react-router-dom 會載入 CJS 版，再 require 一份 CJS 的 react-router，
      // 與程式碼直接 import 的 ESM 版 react-router 是兩份，Router context 不共用。
      // 讓 react-router-dom 改用 ESM 版，並交給 Vite 處理，兩邊才會是同一份。
      alias: [
        {
          find: /^react-router-dom$/,
          replacement: fileURLToPath(
            new URL("./node_modules/react-router-dom/dist/index.mjs", import.meta.url),
          ),
        },
      ],
      server: { deps: { inline: ["react-router", "react-router-dom", "react-loader-spinner"] } },
    },
  }),
);
