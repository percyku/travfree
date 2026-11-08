import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrders from "./AdminOrders";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import {
  closeDialog,
  findDialog,
  findToast,
  Landing,
  renderRoutes,
  signInAsAdmin,
  waitForDialogClosed,
} from "../../test/render";
import { coupon, lineItem, order, pagination, product, tokyo } from "../../test/fixtures";

const PAID_AT = 1793800000; // Unix 秒

// 下單時套用八折；東京是套用後才加入，沒有優惠
const withCoupon = (() => {
  const taipeiItem = lineItem(product(), 3, { id: "item-1", appliedCoupon: coupon() });
  const tokyoItem = lineItem(tokyo, 1, { id: "item-2" });
  return order({
    message: "希望安排靠窗座位",
    total: taipeiItem.final_total + tokyoItem.final_total,
    products: { [taipeiItem.id]: taipeiItem, [tokyoItem.id]: tokyoItem },
  });
})();

const paidNoCoupon = (() => {
  const item = lineItem(tokyo, 2, { id: "item-3" });
  return order({
    id: "7c2e9a10-1b3d-4f5e-8a7b-9c0d1e2f3a4b",
    is_paid: true,
    paid_date: PAID_AT,
    status: 3,
    total: item.final_total,
    user: { name: "陳大文", email: "chen@example.com", tel: "0922333444", address: "高雄市" },
    products: { [item.id]: item },
  });
})();

/** 模擬後台訂單 API，記錄前端送出的請求 */
const useOrderBackend = (options = {}) => {
  const requests = [];
  server.use(
    api.get("/api/admin/orders", ({ request }) => {
      const page = new URL(request.url).searchParams.get("page");
      requests.push(["GET", page]);
      return {
        json: {
          success: true,
          orders: [withCoupon, paidNoCoupon],
          pagination: pagination({ total_pages: 2 }),
          messages: [],
        },
      };
    }),
    api.put("/api/admin/order/{id}", ({ params, body }) => {
      requests.push([`PUT ${params.id}`, body]);
      return options.updateError
        ? failure(404, options.updateError)
        : { json: { success: true, message: "已更新訂單資訊" } };
    }),
  );
  return requests;
};

const renderPage = () =>
  renderRoutes(
    [
      { path: "/admin/orders", element: <AdminOrders /> },
      { path: "/login", element: <Landing name="登入頁" /> },
    ],
    { route: "/admin/orders" },
  );

const rowOf = async (text) => (await screen.findByText(text)).closest("tr");

const openOrder = async (id) => {
  const row = within(await rowOf(id));
  await userEvent.click(row.getByRole("button", { name: "查看" }));
  return within(await findDialog());
};

/** modal 費用表某一列（依第一欄文字）的各欄內容 */
const cellsOf = (dialog, label) =>
  [...dialog.getByText(label).closest("tr").querySelectorAll("td")].map(
    (td) => td.textContent,
  );

describe("後台訂單", () => {
  beforeEach(signInAsAdmin);

  it("列出訂單金額、優惠券、付款狀態與付款時間（秒）", async () => {
    useOrderBackend();
    renderPage();

    const first = within(await rowOf(withCoupon.id));
    expect(first.getByText("王小明test@example.com")).toBeInTheDocument();
    expect(first.getByText("$121000")).toBeInTheDocument();
    expect(first.getByText("TEST80")).toBeInTheDocument();
    expect(first.getAllByText("未付款")).toHaveLength(2); // 付款狀態、付款日期
    expect(first.getByText("希望安排靠窗座位")).toBeInTheDocument();

    const second = within(await rowOf(paidNoCoupon.id));
    expect(second.getByText("—")).toBeInTheDocument();
    expect(second.getByText("付款完成")).toBeInTheDocument();
    expect(
      second.getByText(new Date(PAID_AT * 1000).toLocaleString()),
    ).toBeInTheDocument();
  });

  it("訂單明細列出各品項與優惠券快照", async () => {
    useOrderBackend();
    renderPage();

    const dialog = await openOrder(withCoupon.id);
    expect(dialog.getByText(`編輯 ${withCoupon.id}`)).toBeInTheDocument();
    expect(dialog.getByDisplayValue("台北市信義區市府路1號")).toBeInTheDocument();
    expect(dialog.getByDisplayValue("希望安排靠窗座位")).toBeInTheDocument();

    expect(cellsOf(dialog, "台北3日遊")).toEqual(["台北3日遊", "3", "$120,000", "$96,000", "TEST80"]);
    expect(cellsOf(dialog, "東京5日遊")).toEqual(["東京5日遊", "1", "$25,000", "$25,000", "—"]);
    expect(cellsOf(dialog, "商品小計")).toEqual(["商品小計", "$145,000", ""]);
    expect(cellsOf(dialog, "優惠券折抵")).toEqual([
      "優惠券折抵",
      "-$24,000",
      "TEST80（測試八折，8 折）",
    ]);
    expect(cellsOf(dialog, "實付金額")).toEqual(["實付金額", "$121,000", ""]);
    await closeDialog(userEvent, "關閉");
  });

  it("沒有使用優惠券的訂單", async () => {
    useOrderBackend();
    renderPage();

    const dialog = await openOrder(paidNoCoupon.id);
    expect(cellsOf(dialog, "優惠券折抵")).toEqual(["優惠券折抵", "-$0", "未使用"]);
    expect(dialog.getByLabelText(/付款狀態/)).toBeChecked();
    expect(dialog.getByRole("combobox")).toHaveValue("3");
    await closeDialog(userEvent, "關閉");
  });

  it("修改付款與外送狀態：status 以字串送出", async () => {
    const requests = useOrderBackend();
    renderPage();

    const dialog = await openOrder(withCoupon.id);
    await userEvent.click(dialog.getByLabelText(/付款狀態/));
    expect(dialog.getByText("付款狀態 (已付款)")).toBeInTheDocument();
    await userEvent.selectOptions(dialog.getByRole("combobox"), "外送中");
    await userEvent.click(dialog.getByRole("button", { name: "儲存" }));

    expect(await findToast("已更新訂單資訊")).toBeInTheDocument();
    const [, body] = requests.find(([method]) => method === `PUT ${withCoupon.id}`);
    expect(body.data).toMatchObject({ is_paid: true, status: "2" });
    await waitForDialogClosed();
    expect(requests.filter(([method]) => method === "GET")).toHaveLength(2);
  });

  it("更新失敗時顯示後端原因", async () => {
    useOrderBackend({ updateError: "找不到訂單" });
    renderPage();

    const dialog = await openOrder(withCoupon.id);
    await userEvent.click(dialog.getByRole("button", { name: "儲存" }));

    expect(await findToast("更新失敗! 找不到訂單")).toBeInTheDocument();
    await closeDialog(userEvent, "關閉");
  });

  it("切換分頁時帶上頁碼", async () => {
    const requests = useOrderBackend();
    renderPage();
    await rowOf(withCoupon.id);

    await userEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(requests).toContainEqual(["GET", "2"]));
  });

  it("取得資料失敗時導向登入頁", async () => {
    server.use(
      api.get("/api/admin/orders", () => failure(401, "驗證錯誤, 請重新登入")),
    );
    renderPage();

    expect(await findToast("取得資料失敗，請重新登入")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁");
  });
});
