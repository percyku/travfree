// 多個測試共用的 MSW handler
import { api } from "./contract";
import { server } from "./server";
import { cartResponse } from "./fixtures";

/**
 * 會員登入或註冊後，前端會合併訪客購物車再重新讀取購物車。
 * 回傳收到的 merge 請求，用來斷言 X-Cart-Id 與 Authorization。
 */
export const useCartMerge = (items = []) => {
  const merges = [];
  server.use(
    api.post("/api/cart/merge", ({ request }) => {
      merges.push({
        cartId: request.headers.get("x-cart-id"),
        authorization: request.headers.get("authorization"),
      });
      return { json: { success: true, data: cartResponse(items).json.data, messages: [] } };
    }),
    api.get("/api/cart", () => cartResponse(items)),
  );
  return merges;
};
