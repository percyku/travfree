// 確認契約檢查本身有效：格式錯誤時一定會記錄，不會默默通過
import { afterEach, describe, expect, it } from "vitest";
import axios from "axios";
import { api, API_BASE, violations } from "./contract";
import { server } from "./server";
import { adminUser, cartResponse } from "./fixtures";

const API = API_BASE;

describe("契約檢查", () => {
  afterEach(() => {
    // 這些測試故意製造違規，檢查完就清掉，不讓 setup.js 判定失敗
    violations.splice(0);
  });

  it("spec 沒有的路徑在定義 handler 時就丟錯", () => {
    expect(() => api.get("/api/not-exist", () => ({}))).toThrow(
      "spec 沒有 GET /api/not-exist",
    );
  });

  it("請求 body 不符合 spec 時記錄違規", async () => {
    server.use(
      api.post("/api/coupon", () => ({
        json: { success: true, message: "ok", data: { final_total: 1 } },
      })),
    );
    await axios.post(`${API}/api/coupon`, { code: "TEST80" }); // 少了 data 包裝
    expect(violations).toEqual([
      expect.stringContaining("POST /api/coupon 請求不符合 spec"),
    ]);
  });

  it("回應假資料不符合 spec 時記錄違規", async () => {
    server.use(
      api.get("/api/cart", () => ({
        json: { success: true, data: { carts: [] }, messages: [] },
      })),
    );
    await axios.get(`${API}/api/cart`);
    expect(violations).toEqual([
      expect.stringContaining("GET /api/cart 200 測試假資料不符合 spec"),
    ]);
  });

  it("spec 沒列出的狀態碼要符合 default 的錯誤格式", async () => {
    server.use(
      api.get("/api/cart", () => ({ status: 201, ...cartResponse([]) })),
    );
    await axios.get(`${API}/api/cart`);
    expect(violations).toEqual([
      expect.stringContaining("GET /api/cart 201 測試假資料不符合 spec"),
    ]);
  });

  it("需要 token 的端點沒帶 Authorization 時記錄違規", async () => {
    server.use(
      api.post("/api/user/check", () => ({
        json: { success: true, ...adminUser() },
      })),
    );
    await axios.post(`${API}/api/user/check`);
    expect(violations).toEqual([expect.stringContaining("需要 token")]);
  });

  it("multipart 缺少 spec 要求的欄位時記錄違規", async () => {
    server.use(
      api.post("/api/admin/upload", () => ({
        json: { success: true, imageUrl: "http://localhost/a.png" },
      })),
    );
    const form = new FormData();
    form.append("file", new File(["x"], "a.png", { type: "image/png" })); // 欄位名稱錯誤
    await axios.post(`${API}/api/admin/upload`, form, {
      headers: { Authorization: "token" },
    });
    expect(violations).toEqual([
      expect.stringContaining("缺少 multipart 欄位 file-to-upload"),
    ]);
  });

  it("沒有定義 handler 的請求記錄違規", async () => {
    await axios.get(`${API}/api/products`).catch(() => {});
    expect(violations).toEqual([
      expect.stringContaining("測試沒有定義 handler"),
    ]);
  });
});
