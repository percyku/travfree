import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartForm from "./CartForm";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { Landing, renderRoutes } from "../../test/render";
import { cartResponse, coupon, lineItem, product } from "../../test/fixtures";

const ORDER_ID = "51149043-3529-456d-93de-691e7cdf5d0d";

const renderCartForm = () =>
  renderRoutes(
    [
      { path: "/cartform", element: <CartForm /> },
      { path: "/cartcheckout", element: <Landing name="購物車頁" /> },
      { path: "/cartsuccess/:orderId", element: <Landing name="訂單成功頁 " /> },
    ],
    { route: "/cartform" },
  );

const summaryCard = () =>
  screen.getByRole("heading", { name: "費用明細" }).closest(".card");

const submitButton = () =>
  within(summaryCard()).getByRole("button", { name: "送出訂單" });

const fillForm = async () => {
  await userEvent.type(screen.getByLabelText("收件人姓名"), "王小明");
  await userEvent.type(screen.getByLabelText("Email"), "test@example.com");
  await userEvent.type(screen.getByLabelText("收件人電話"), "0912345678");
  await userEvent.type(screen.getByLabelText("收件人地址"), "台北市信義區市府路1號");
  await userEvent.type(screen.getByLabelText("留言"), "希望安排靠窗座位");
};

const toast = (text) => screen.findByText(text, { selector: ".toast-body" });

describe("填寫資料頁", () => {
  it("進入頁面時重新讀取購物車，顯示最新總計", async () => {
    server.use(
      api.get("/api/cart", () =>
        cartResponse([lineItem(product(), 3, { appliedCoupon: coupon() })]),
      ),
    );
    renderCartForm();

    expect(
      await within(summaryCard()).findByText("NT$ 96,000"),
    ).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("購物車是空的時不能送出", async () => {
    server.use(api.get("/api/cart", () => cartResponse([])));
    renderCartForm();

    await waitFor(() => expect(submitButton()).toBeDisabled());
  });

  it("欄位驗證失敗時顯示原因，不送出訂單", async () => {
    server.use(api.get("/api/cart", () => cartResponse([lineItem(product(), 1)])));
    renderCartForm();
    await within(summaryCard()).findByText("NT$ 40,000");

    await userEvent.click(submitButton());
    expect(await screen.findByText("請輸入收件人姓名。")).toBeInTheDocument();
    expect(screen.getByText("請輸入 Email。")).toBeInTheDocument();
    expect(screen.getByText("請輸入收件人電話。")).toBeInTheDocument();
    expect(screen.getByText("請輸入收件人地址。")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("收件人姓名"), "王");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("收件人電話"), "09-1234-5678");
    expect(await screen.findByText("姓名最少兩個字")).toBeInTheDocument();
    expect(screen.getByText("Email 格式不正確。")).toBeInTheDocument();
    expect(screen.getByText("電話號碼格式不正確，僅限數字。")).toBeInTheDocument();
    // 沒有定義 POST /api/order 的 handler，有送出的話契約檢查會失敗
  });

  it("送出訂單時帶上畫面顯示的總計，成功後前往訂單成功頁", async () => {
    let orderBody;
    server.use(
      api.get("/api/cart", () =>
        cartResponse([lineItem(product(), 3, { appliedCoupon: coupon() })]),
      ),
      api.post("/api/order", ({ body }) => {
        orderBody = body;
        return {
          json: {
            success: true,
            message: "已建立訂單",
            total: 96000,
            create_at: 1793799389,
            orderId: ORDER_ID,
          },
        };
      }),
    );
    renderCartForm();
    await within(summaryCard()).findByText("NT$ 96,000");

    await fillForm();
    await userEvent.click(submitButton());

    expect(await screen.findByTestId("landing")).toHaveTextContent(
      `訂單成功頁 ${ORDER_ID}`,
    );
    expect(orderBody.data).toMatchObject({
      user: {
        name: "王小明",
        email: "test@example.com",
        tel: "0912345678",
        address: "台北市信義區市府路1號",
      },
      message: "希望安排靠窗座位",
      final_total: 96000,
    });
  });

  it("金額已變動（409）時顯示原因、留在本頁並更新總計", async () => {
    let couponValid = true;
    server.use(
      api.get("/api/cart", () =>
        cartResponse([
          lineItem(product(), 3, couponValid ? { appliedCoupon: coupon() } : {}),
        ]),
      ),
      api.post("/api/order", () => {
        couponValid = false; // 後台在顧客填資料時停用了優惠券
        return failure(409, "訂單金額已變動，請重新確認");
      }),
    );
    renderCartForm();
    await within(summaryCard()).findByText("NT$ 96,000");

    await fillForm();
    await userEvent.click(submitButton());

    expect(await toast("訂單金額已變動，請重新確認")).toBeInTheDocument();
    expect(
      await within(summaryCard()).findByText("NT$ 120,000"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("landing")).not.toBeInTheDocument();
    expect(screen.getByLabelText("收件人姓名")).toHaveValue("王小明");
  });

  it("返回購物車", async () => {
    server.use(api.get("/api/cart", () => cartResponse([lineItem(product(), 1)])));
    renderCartForm();

    await userEvent.click(screen.getByRole("button", { name: "返回購物車" }));
    expect(screen.getByTestId("landing")).toHaveTextContent("購物車頁");
  });
});
