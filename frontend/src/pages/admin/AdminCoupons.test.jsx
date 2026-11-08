import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCoupons from "./AdminCoupons";
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
import { coupon, pagination } from "../../test/fixtures";
import { dateInputToSeconds, secondsToDateInput } from "../../utils/coupon";

const NOW = Math.floor(Date.now() / 1000);
const active = coupon();
const disabledExpired = coupon({
  id: "0d1e2f3a-4b5c-6d7e-8f90-a1b2c3d4e5f6",
  title: "過期九折",
  code: "OLD90",
  percent: 90,
  due_date: NOW - 86400,
  is_enabled: 0,
});

/**
 * 模擬後台優惠券 API，記錄前端送出的請求。
 * @param {object[]} coupons 列表
 */
const useCouponBackend = (coupons = [active, disabledExpired], options = {}) => {
  const requests = [];
  server.use(
    api.get("/api/admin/coupons", ({ request }) => {
      const page = new URL(request.url).searchParams.get("page");
      requests.push(["GET", page]);
      return {
        json: {
          success: true,
          coupons,
          pagination: pagination({
            total_pages: 2,
            current_page: Number(page),
            has_pre: page === "2",
            has_next: page === "1",
          }),
          messages: [],
        },
      };
    }),
    api.post("/api/admin/coupon", ({ body }) => {
      requests.push(["POST", body]);
      return options.createError
        ? failure(400, options.createError)
        : { json: { success: true, message: "已建立優惠券" } };
    }),
    api.put("/api/admin/coupon/{id}", ({ params, body }) => {
      requests.push([`PUT ${params.id}`, body]);
      return { json: { success: true, message: "已更新優惠券" } };
    }),
    api.delete("/api/admin/coupon/{id}", ({ params }) => {
      requests.push([`DELETE ${params.id}`]);
      return { json: { success: true, message: "已刪除優惠券" } };
    }),
  );
  return requests;
};

const renderPage = () =>
  renderRoutes(
    [
      { path: "/admin/coupons", element: <AdminCoupons /> },
      { path: "/login", element: <Landing name="登入頁" /> },
    ],
    { route: "/admin/coupons" },
  );

const rowOf = async (text) => (await screen.findByText(text)).closest("tr");

describe("後台優惠券", () => {
  beforeEach(signInAsAdmin);

  it("列出優惠券的折扣、到期日與狀態", async () => {
    useCouponBackend();
    renderPage();

    const row = within(await rowOf("測試八折"));
    expect(row.getByText("TEST80")).toBeInTheDocument();
    expect(row.getByText("付 80%（8 折）")).toBeInTheDocument();
    expect(
      row.getByText(new Date(active.due_date * 1000).toLocaleDateString()),
    ).toBeInTheDocument();
    expect(row.queryByText("已過期")).not.toBeInTheDocument();
    expect(row.getByText("啟用")).toBeInTheDocument();

    const old = within(await rowOf("過期九折"));
    expect(old.getByText("付 90%（9 折）")).toBeInTheDocument();
    expect(old.getByText("已過期")).toBeInTheDocument();
    expect(old.getByText("停用")).toBeInTheDocument();
  });

  it("沒有優惠券時顯示提示", async () => {
    useCouponBackend([]);
    renderPage();

    expect(await screen.findByText("目前沒有優惠券")).toBeInTheDocument();
  });

  it("新增優惠券：到期日換算成當天 23:59:59 的秒數，前後空白會去掉", async () => {
    const requests = useCouponBackend();
    renderPage();
    await rowOf("測試八折");

    await userEvent.click(screen.getByRole("button", { name: "建立新的優惠券" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("新增優惠券")).toBeInTheDocument();
    expect(dialog.getByLabelText("實付比例（%）")).toHaveValue(80);
    expect(dialog.getByText("8 折")).toBeInTheDocument();

    await userEvent.type(dialog.getByLabelText("名稱"), " 週年慶 ");
    await userEvent.type(dialog.getByLabelText("優惠碼"), " ANNIV85 ");
    await userEvent.clear(dialog.getByLabelText("實付比例（%）"));
    await userEvent.type(dialog.getByLabelText("實付比例（%）"), "85");
    expect(dialog.getByText("85 折")).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText("到期日"), "2030-12-31");
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("已建立優惠券")).toBeInTheDocument();
    expect(requests).toContainEqual([
      "POST",
      {
        data: {
          title: "週年慶",
          code: "ANNIV85",
          percent: 85,
          due_date: dateInputToSeconds("2030-12-31"),
          is_enabled: 1,
        },
      },
    ]);
    await waitForDialogClosed();
    expect(requests.filter(([method]) => method === "GET")).toEqual([
      ["GET", "1"],
      ["GET", "1"],
    ]);
  });

  it("沒有選到期日時提示，不送出", async () => {
    const requests = useCouponBackend();
    renderPage();
    await rowOf("測試八折");

    await userEvent.click(screen.getByRole("button", { name: "建立新的優惠券" }));
    const dialog = within(await findDialog());
    await userEvent.type(dialog.getByLabelText("名稱"), "週年慶");
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("請選擇到期日")).toBeInTheDocument();
    expect(requests.some(([method]) => method === "POST")).toBe(false);
    await closeDialog(userEvent);
  });

  it("新增失敗時顯示後端原因，modal 保持開啟", async () => {
    useCouponBackend(undefined, { createError: "code 已存在" });
    renderPage();
    await rowOf("測試八折");

    await userEvent.click(screen.getByRole("button", { name: "建立新的優惠券" }));
    const dialog = within(await findDialog());
    await userEvent.type(dialog.getByLabelText("名稱"), "重複");
    await userEvent.type(dialog.getByLabelText("優惠碼"), "TEST80");
    await userEvent.type(dialog.getByLabelText("到期日"), "2030-12-31");
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("新增失敗! code 已存在")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await closeDialog(userEvent);
  });

  it("編輯優惠券：帶入原本的值，到期日維持同一天", async () => {
    const requests = useCouponBackend();
    renderPage();

    const row = within(await rowOf("過期九折"));
    await userEvent.click(row.getByRole("button", { name: "編輯" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("更新優惠券")).toBeInTheDocument();
    expect(dialog.getByLabelText("名稱")).toHaveValue("過期九折");
    expect(dialog.getByLabelText("優惠碼")).toHaveValue("OLD90");
    expect(dialog.getByLabelText("實付比例（%）")).toHaveValue(90);
    const date = secondsToDateInput(disabledExpired.due_date);
    expect(dialog.getByLabelText("到期日")).toHaveValue(date);
    expect(dialog.getByLabelText("啟用")).not.toBeChecked();

    await userEvent.click(dialog.getByLabelText("啟用"));
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("已更新優惠券")).toBeInTheDocument();
    expect(requests).toContainEqual([
      `PUT ${disabledExpired.id}`,
      {
        data: {
          title: "過期九折",
          code: "OLD90",
          percent: 90,
          due_date: dateInputToSeconds(date),
          is_enabled: 1,
        },
      },
    ]);
    await waitForDialogClosed();
  });

  it("刪除前說明影響，並建議改為停用", async () => {
    const requests = useCouponBackend();
    renderPage();

    const row = within(await rowOf("測試八折"));
    await userEvent.click(row.getByRole("button", { name: "刪除" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("刪除優惠券")).toBeInTheDocument();
    expect(dialog.getByText(/確定要刪除/)).toHaveTextContent(
      "確定要刪除測試八折（TEST80）嗎？",
    );
    expect(dialog.getByText(/建議改為取消「啟用」/)).toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "刪除" }));

    expect(await findToast("已刪除優惠券")).toBeInTheDocument();
    expect(requests).toContainEqual([`DELETE ${active.id}`]);
    await waitForDialogClosed();
  });

  it("切換分頁時帶上頁碼", async () => {
    const requests = useCouponBackend();
    renderPage();
    await rowOf("測試八折");

    await userEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(requests).toContainEqual(["GET", "2"]));
  });

  it("token 失效（401）時提示並導向登入頁", async () => {
    server.use(
      api.get("/api/admin/coupons", () => failure(401, "驗證錯誤, 請重新登入")),
    );
    renderPage();

    expect(await findToast("取得資料失敗，請重新登入")).toBeInTheDocument();
    expect(screen.getByTestId("landing")).toHaveTextContent("登入頁");
  });
});
