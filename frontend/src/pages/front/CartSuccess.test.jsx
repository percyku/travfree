import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartSuccess from "./CartSuccess";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { renderRoutes } from "../../test/render";
import { order } from "../../test/fixtures";

const ORDER_ID = order().id;
const PAID_AT = 1793800000; // Unix 秒

const renderSuccess = () =>
  renderRoutes([{ path: "/cartsuccess/:orderId", element: <CartSuccess /> }], {
    route: `/cartsuccess/${ORDER_ID}`,
  });

const toast = (text) => screen.findByText(text, { selector: ".toast-body" });

describe("訂單成功頁", () => {
  it("顯示訂單品項與折扣後總計", async () => {
    server.use(
      api.get("/api/order/{id}", () => ({ json: { success: true, order: order() } })),
    );
    renderSuccess();

    expect(await screen.findByText("台北3日遊")).toBeInTheDocument();
    expect(screen.getByText("x3")).toBeInTheDocument();
    expect(screen.getByText("NT$96000")).toBeInTheDocument(); // 品項折扣後
    expect(screen.getByText("NT$96,000")).toBeInTheDocument(); // 總計
    expect(screen.getByText("未付款")).toBeInTheDocument();
  });

  it("付款後重新讀取訂單，顯示已付款與付款時間", async () => {
    let paid = false;
    let payCalledWith;
    server.use(
      api.get("/api/order/{id}", () => ({
        json: {
          success: true,
          order: order(paid ? { is_paid: true, paid_date: PAID_AT } : {}),
        },
      })),
      api.post("/api/pay/{id}", ({ params }) => {
        payCalledWith = params.id;
        paid = true;
        return { json: { success: true, message: "付款完成" } };
      }),
    );
    renderSuccess();

    await userEvent.click(await screen.findByRole("button", { name: "立即付款" }));

    expect(await toast("付款完成")).toBeInTheDocument();
    expect(payCalledWith).toBe(ORDER_ID);
    expect(
      await screen.findByText(
        `已付款（${new Date(PAID_AT * 1000).toLocaleString()}）`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "立即付款" })).not.toBeInTheDocument();
  });

  it("付款失敗時顯示後端原因", async () => {
    server.use(
      api.get("/api/order/{id}", () => ({ json: { success: true, order: order() } })),
      api.post("/api/pay/{id}", () => failure(400, "訂單已付款")),
    );
    renderSuccess();

    await userEvent.click(await screen.findByRole("button", { name: "立即付款" }));
    expect(await toast("訂單已付款")).toBeInTheDocument();
  });

  it("找不到訂單時（order 為 null）不顯示付款狀態", async () => {
    let requested = false;
    server.use(
      api.get("/api/order/{id}", () => {
        requested = true;
        return { json: { success: true, order: null } };
      }),
    );
    renderSuccess();

    await screen.findByText("商品選購成功");
    await expect.poll(() => requested).toBe(true);
    expect(screen.queryByText("付款狀態")).not.toBeInTheDocument();
  });
});
