import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Google 登入（GIS）在 http://localhost 測試時要求的設定，與 nginx.conf 相同
    headers: { "Referrer-Policy": "no-referrer-when-downgrade" },
  },
});
