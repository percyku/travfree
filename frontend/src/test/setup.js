import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import axios from "axios";
import { violations } from "./contract";
import { server } from "./server";
import { resetGoogleCache } from "../utils/google";
import { File as NodeFile } from "node:buffer";

// jsdom 的 FormData、File 與 Node 的 fetch（MSW 用來重建請求）不相容，multipart 會被當成純文字。
// 測試中改用 Node 內建的版本；Response 是 Node 的，可以從它取得 Node 的 FormData。
const NodeFormData = (
  await new Response("a=1", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
  }).formData()
).constructor;
globalThis.FormData = NodeFormData;
globalThis.File = NodeFile;

beforeAll(() => {
  server.listen({
    onUnhandledRequest: ({ method, url }) => {
      violations.push(`測試沒有定義 handler：${method} ${url}`);
    },
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  // 登入狀態存在 cookie 與 axios 預設 header，清掉以免影響下一個測試
  document.cookie.split("; ").forEach((row) => {
    const name = row.split("=")[0];
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
  delete axios.defaults.headers.common.Authorization;
  localStorage.clear();
  // Google 的設定與假的 GIS 物件不跨測試保留
  resetGoogleCache();
  delete window.google;

  const found = violations.splice(0);
  if (found.length > 0) {
    throw new Error(`API 契約檢查失敗：\n- ${found.join("\n- ")}`);
  }
});

afterAll(() => server.close());
