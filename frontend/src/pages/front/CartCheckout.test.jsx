import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartCheckout from "./CartCheckout";
import { createAsyncGetCart } from "../../slice/cartSlice";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { Landing, renderRoutes } from "../../test/render";
import {
  cartResponse,
  coupon,
  lineItem,
  product,
  tokyo,
} from "../../test/fixtures";

const taipei = product();

/**
 * 模擬後端的購物車，套用、移除優惠券與改數量後重新讀取會拿到新狀態。
 * @returns 記錄前端送出的請求，方便斷言
 */
const useCartBackend = (initialItems) => {
  let items = initialItems;
  const requests = [];
  server.use(
    api.get("/api/cart", () => cartResponse(items)),
    api.post("/api/coupon", ({ body }) => {
      requests.push(["POST /api/coupon", body]);
      if (body.data.code !== "TEST80") return failure(404, "找不到優惠券");
      items = items.map((item) =>
        lineItem(item.product, item.qty, { id: item.id, appliedCoupon: coupon() }),
      );
      const final_total = items.reduce((sum, i) => sum + i.final_total, 0);
      return {
        json: {
          success: true,
          message: "已套用優惠券:TEST80",
          data: { final_total },
        },
      };
    }),
    api.delete("/api/coupon", () => {
      requests.push(["DELETE /api/coupon"]);
      items = items.map((item) => lineItem(item.product, item.qty, { id: item.id }));
      const final_total = items.reduce((sum, i) => sum + i.final_total, 0);
      return {
        json: { success: true, message: "已移除優惠券", data: { final_total } },
      };
    }),
    api.put("/api/cart/{id}", ({ params, body }) => {
      requests.push([`PUT /api/cart/${params.id}`, body]);
      items = items.map((item) =>
        item.id === params.id
          ? lineItem(item.product, body.data.qty, {
              id: item.id,
              appliedCoupon: item.coupon,
            })
          : item,
      );
      return {
        json: { success: true, message: "已更新購物車", data: body.data },
      };
    }),
    api.delete("/api/cart/{id}", ({ params }) => {
      requests.push([`DELETE /api/cart/${params.id}`]);
      items = items.filter((item) => item.id !== params.id);
      return { json: { success: true, message: "已刪除" } };
    }),
    api.delete("/api/carts", () => {
      requests.push(["DELETE /api/carts"]);
      items = [];
      return { json: { success: true, message: "已刪除" } };
    }),
  );
  return requests;
};

/** Header 平常會讀取購物車，這裡由測試自己讀取後再渲染頁面 */
const renderCartPage = async () => {
  const utils = renderRoutes(
    [
      { path: "/cartcheckout", element: <CartCheckout /> },
      { path: "/cartform", element: <Landing name="填寫資料頁" /> },
      { path: "/product", element: <Landing name="產品頁" /> },
    ],
    { route: "/cartcheckout" },
  );
  await utils.store.dispatch(createAsyncGetCart());
  return utils;
};

/** 桌機版的費用明細卡片（手機版的展開明細是同樣的內容） */
const summaryCard = () =>
  screen.getByRole("heading", { name: "費用明細" }).closest(".card");

/** 費用明細某一列右側的金額 */
const amountOf = (label) => {
  const row = within(summaryCard()).getByText(label).closest("div");
  return row.querySelector("p:last-child").textContent;
};

const toast = (text) => screen.findByText(text, { selector: ".toast-body" });

describe("購物車頁", () => {
  it("費用明細分開列出商品特價折抵與優惠券折抵", async () => {
    useCartBackend([
      lineItem(taipei, 3, { appliedCoupon: coupon() }),
      lineItem(tokyo, 1, { appliedCoupon: coupon() }),
    ]);
    await renderCartPage();

    // 原價 50000×3 + 30000×1；售價 40000×3 + 25000×1；八折
    expect(amountOf("原價小計")).toBe("NT$ 180,000");
    expect(amountOf("商品特價折抵")).toBe("- NT$ 35,000");
    expect(amountOf("優惠券折抵")).toBe("- NT$ 29,000");
    expect(within(summaryCard()).getByText("NT$ 116,000")).toBeInTheDocument();
    expect(within(summaryCard()).getByText("TEST80")).toBeInTheDocument();
  });

  it("購物車是空的時顯示空狀態，可前往產品頁", async () => {
    useCartBackend([]);
    await renderCartPage();

    expect(screen.getByText("購物車還沒有商品，立即逛逛！")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "前往旅程" }));
    expect(screen.getByTestId("landing")).toHaveTextContent("產品頁");
  });

  it("套用優惠碼後重新讀取購物車並顯示折抵", async () => {
    const requests = useCartBackend([lineItem(taipei, 3)]);
    await renderCartPage();
    const card = within(summaryCard());

    expect(amountOf("優惠券折抵")).toBe("- NT$ 0");
    await userEvent.type(card.getByLabelText("優惠碼"), "  TEST80 ");
    await userEvent.click(card.getByRole("button", { name: "套用" }));

    expect(await toast("已套用優惠券:TEST80")).toBeInTheDocument();
    expect(requests).toContainEqual([
      "POST /api/coupon",
      { data: { code: "TEST80" } }, // 前後空白會去掉
    ]);
    await waitFor(() => expect(amountOf("優惠券折抵")).toBe("- NT$ 24,000"));
    expect(card.getByText(/已套用優惠碼 TEST80/)).toBeInTheDocument();
    expect(card.getByLabelText("優惠碼")).toHaveValue("");
  });

  it("優惠碼無效時顯示後端原因，並保留輸入內容", async () => {
    useCartBackend([lineItem(taipei, 1)]);
    await renderCartPage();
    const card = within(summaryCard());

    await userEvent.type(card.getByLabelText("優惠碼"), "WRONG");
    await userEvent.click(card.getByRole("button", { name: "套用" }));

    expect(await toast("找不到優惠券")).toBeInTheDocument();
    expect(card.getByLabelText("優惠碼")).toHaveValue("WRONG");
    expect(card.queryByText(/已套用優惠碼/)).not.toBeInTheDocument();
  });

  it("沒有輸入優惠碼時不能套用", async () => {
    useCartBackend([lineItem(taipei, 1)]);
    await renderCartPage();
    const card = within(summaryCard());

    expect(card.getByRole("button", { name: "套用" })).toBeDisabled();
    await userEvent.type(card.getByLabelText("優惠碼"), "   ");
    expect(card.getByRole("button", { name: "套用" })).toBeDisabled();
  });

  it("移除已套用的優惠券", async () => {
    const requests = useCartBackend([
      lineItem(taipei, 3, { appliedCoupon: coupon() }),
    ]);
    await renderCartPage();
    const card = within(summaryCard());

    await userEvent.click(card.getByRole("button", { name: "移除" }));

    expect(await toast("已移除優惠券")).toBeInTheDocument();
    expect(requests).toContainEqual(["DELETE /api/coupon"]);
    await waitFor(() =>
      expect(card.queryByText(/已套用優惠碼/)).not.toBeInTheDocument(),
    );
    expect(amountOf("優惠券折抵")).toBe("- NT$ 0");
  });

  it("套用後才加入的商品沒有優惠，提示需要重新套用", async () => {
    useCartBackend([
      lineItem(taipei, 1, { appliedCoupon: coupon() }),
      lineItem(tokyo, 1),
    ]);
    await renderCartPage();

    expect(
      within(summaryCard()).getByText(/之後加入的商品需要重新套用/),
    ).toBeInTheDocument();
  });

  it("調整數量時直接設定新的數量，數量為 1 時不能再減", async () => {
    const item = lineItem(taipei, 1, { id: "item-1" });
    const requests = useCartBackend([item]);
    await renderCartPage();

    const [minus] = screen.getAllByRole("button", { name: "remove" });
    const [plus] = screen.getAllByRole("button", { name: "add" });
    expect(minus).toBeDisabled();

    await userEvent.click(plus);
    expect(await toast("更新成功")).toBeInTheDocument();
    expect(requests).toContainEqual([
      "PUT /api/cart/item-1",
      { data: { product_id: taipei.id, qty: 2 } },
    ]);
    await waitFor(() => expect(minus).toBeEnabled());
    expect(amountOf("原價小計")).toBe("NT$ 100,000");
  });

  it("刪除單一品項與清空購物車", async () => {
    const requests = useCartBackend([
      lineItem(taipei, 1, { id: "item-1" }),
      lineItem(tokyo, 1, { id: "item-2" }),
    ]);
    await renderCartPage();

    await userEvent.click(screen.getAllByRole("button", { name: "刪除" })[0]);
    expect(await toast("刪除成功")).toBeInTheDocument();
    expect(requests).toContainEqual(["DELETE /api/cart/item-1"]);
    await waitFor(() =>
      expect(screen.queryByText(taipei.title)).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "刪除選中活動" }));
    expect(await toast("刪除全部項目成功")).toBeInTheDocument();
    expect(
      await screen.findByText("購物車還沒有商品，立即逛逛！"),
    ).toBeInTheDocument();
  });

  it("前往結帳", async () => {
    useCartBackend([lineItem(taipei, 1)]);
    await renderCartPage();

    await userEvent.click(
      within(summaryCard()).getByRole("button", { name: "前往結賬" }),
    );
    expect(screen.getByTestId("landing")).toHaveTextContent("填寫資料頁");
  });
});
