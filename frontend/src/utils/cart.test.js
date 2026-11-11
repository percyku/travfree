import { afterEach, describe, expect, it, vi } from "vitest";
import { getCartId } from "./cart";
import { makeStore } from "../store/store";
import { createAsyncGetCart } from "../slice/cartSlice";
import { api } from "../test/contract";
import { server } from "../test/server";
import { cartResponse } from "../test/fixtures";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("訪客購物車的識別", () => {
  afterEach(() => vi.restoreAllMocks());

  it("第一次產生 UUID 存進 localStorage，之後沿用", () => {
    const id = getCartId();

    expect(id).toMatch(UUID);
    expect(localStorage.getItem("freetrav-cart-id")).toBe(id);
    expect(getCartId()).toBe(id);
  });

  it("沒有 crypto.randomUUID（非安全來源）時仍產生 v4 UUID", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(getCartId()).toMatch(UUID);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });

  it("localStorage 無法使用時改存在記憶體，同一頁面內沿用", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const id = getCartId();
    expect(id).toMatch(UUID);
    expect(getCartId()).toBe(id);
  });

  it("購物車請求帶上 X-Cart-Id", async () => {
    let header;
    server.use(
      api.get("/api/cart", ({ request }) => {
        header = request.headers.get("x-cart-id");
        return cartResponse([]);
      }),
    );

    await makeStore().dispatch(createAsyncGetCart()).unwrap();

    expect(header).toBe(getCartId());
  });
});
