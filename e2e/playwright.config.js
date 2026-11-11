import { defineConfig, devices } from "@playwright/test";

// 對已啟動的 docker compose 環境執行。平常用根目錄的 npm run e2e，會自動啟動獨立的環境。
export default defineConfig({
  testDir: "./tests",
  // 依序執行，失敗時比較容易看出原因；後台測試也共用同一批種子資料
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // 不重試：不穩定的測試要修正，而不是被重試蓋過
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8100",
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    // 失敗時保留截圖、錄影與 trace，在 HTML 報告中查看
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
