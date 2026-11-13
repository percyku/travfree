import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUsers from "./AdminUsers";
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
import { adminUser, pagination, userRow } from "../../test/fixtures";

const ME = adminUser(); // 預設 admin，只有 ADMIN
const CREATED_AT = 1793799389; // Unix 秒

const me = userRow({ id: ME.uid, email: ME.email, name: ME.name, roles: ["ADMIN"] });
const member = userRow({ create_at: CREATED_AT });
const staff = userRow({
  id: "9b1e2d3c-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
  email: "staff@example.com",
  name: "員工",
  roles: ["USER", "ADMIN"],
});

/** 模擬後台會員 API，記錄前端送出的請求 */
const useUserBackend = ({ users = [member, staff, me], updateError } = {}) => {
  const requests = [];
  let current = users;
  server.use(
    api.get("/api/admin/users", ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(["GET", params.get("page"), params.get("q")]);
      return {
        json: {
          success: true,
          users: current,
          pagination: pagination({ total_pages: current.length === 0 ? 0 : 2, current_page: current.length === 0 ? 0 : 1 }),
        },
      };
    }),
    api.put("/api/admin/user/{id}", ({ params, body }) => {
      requests.push([`PUT ${params.id}`, body]);
      if (updateError) return failure(400, updateError);
      const target = current.find((user) => user.id === params.id);
      const roles = body.data.is_admin ? ["USER", "ADMIN"] : ["USER"];
      const updated = { ...target, roles };
      current = current.map((user) => (user.id === params.id ? updated : user));
      return { json: { success: true, message: "已更新會員權限", user: updated } };
    }),
  );
  return requests;
};

const renderPage = () =>
  renderRoutes(
    [
      { path: "/admin/users", element: <AdminUsers /> },
      { path: "/login", element: <Landing name="登入頁" /> },
    ],
    { route: "/admin/users", preloadedState: { auth: { user: ME, checked: true } } },
  );

const rowOf = async (email) => within((await screen.findByText(email)).closest("tr"));

describe("後台會員列表", () => {
  beforeEach(signInAsAdmin);

  it("列出 email、姓名、角色與註冊時間（秒）", async () => {
    useUserBackend();
    renderPage();

    const row = await rowOf("traveler@example.com");
    expect(row.getByText("王小明")).toBeInTheDocument();
    expect(row.getByText("會員")).toBeInTheDocument();
    expect(row.getByText(new Date(CREATED_AT * 1000).toLocaleDateString())).toBeInTheDocument();
    expect(row.getByRole("button", { name: "將 traveler@example.com 設為管理者" })).toBeEnabled();

    const staffRow = await rowOf("staff@example.com");
    expect(staffRow.getByText("會員")).toBeInTheDocument();
    expect(staffRow.getByText("管理者")).toBeInTheDocument();
    expect(staffRow.getByRole("button", { name: "移除 staff@example.com 的管理者權限" })).toBeEnabled();
  });

  it("自己的管理者權限不能移除", async () => {
    useUserBackend();
    renderPage();

    const row = await rowOf(ME.email);
    expect(row.getByText("你")).toBeInTheDocument();
    expect(row.getByRole("button", { name: `移除 ${ME.email} 的管理者權限` })).toBeDisabled();
  });

  it("確認後設為管理者，列表更新", async () => {
    const requests = useUserBackend();
    renderPage();

    await userEvent.click(
      (await rowOf("traveler@example.com")).getByRole("button", { name: /設為管理者/ }),
    );
    const dialog = within(await findDialog());
    expect(dialog.getByText(/原本的會員身分保留，仍然可以結帳/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "確定設為管理者" }));

    expect(await findToast("已更新會員權限")).toBeInTheDocument();
    expect(requests).toContainEqual([`PUT ${member.id}`, { data: { is_admin: true } }]);
    await waitForDialogClosed();
    const row = await rowOf("traveler@example.com");
    expect(row.getByText("管理者")).toBeInTheDocument();
    expect(row.getByRole("button", { name: /移除/ })).toBeInTheDocument();
  });

  it("確認後移除管理者", async () => {
    const requests = useUserBackend();
    renderPage();

    await userEvent.click((await rowOf("staff@example.com")).getByRole("button", { name: /移除/ }));
    const dialog = within(await findDialog());
    expect(dialog.getByText(/移除後無法進入後台，會員身分保留/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "確定移除管理者" }));

    expect(await findToast("已更新會員權限")).toBeInTheDocument();
    expect(requests).toContainEqual([`PUT ${staff.id}`, { data: { is_admin: false } }]);
    await waitForDialogClosed();
    expect((await rowOf("staff@example.com")).queryByText("管理者")).not.toBeInTheDocument();
  });

  it("只有管理者身分的帳號，移除前說明會變成一般會員", async () => {
    const pureAdmin = userRow({ id: "1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f", email: "ops@example.com", roles: ["ADMIN"] });
    useUserBackend({ users: [pureAdmin, me] });
    renderPage();

    await userEvent.click((await rowOf("ops@example.com")).getByRole("button", { name: /移除/ }));
    const dialog = within(await findDialog());
    expect(dialog.getByText(/此帳號只有管理者身分，移除後會變成一般會員/)).toBeInTheDocument();
    await closeDialog(userEvent);
  });

  it("取消時不送出", async () => {
    // requests 只會有 GET，有送出 PUT 的話斷言失敗
    const requests = useUserBackend();
    renderPage();

    await userEvent.click((await rowOf("staff@example.com")).getByRole("button", { name: /移除/ }));
    await findDialog();
    await closeDialog(userEvent);

    expect(requests.every(([method]) => method === "GET")).toBe(true);
  });

  it("後端拒絕時顯示原因", async () => {
    useUserBackend({ updateError: "至少要保留一位管理者" });
    renderPage();

    await userEvent.click((await rowOf("staff@example.com")).getByRole("button", { name: /移除/ }));
    const dialog = within(await findDialog());
    await userEvent.click(dialog.getByRole("button", { name: "確定移除管理者" }));

    expect(await findToast("更新失敗! 至少要保留一位管理者")).toBeInTheDocument();
    await closeDialog(userEvent);
    expect((await rowOf("staff@example.com")).getByText("管理者")).toBeInTheDocument();
  });

  it("搜尋時從第 1 頁開始並帶上關鍵字，換頁時保留", async () => {
    const requests = useUserBackend();
    renderPage();
    await rowOf("traveler@example.com");

    await userEvent.type(screen.getByRole("searchbox", { name: "搜尋會員" }), "  travel ");
    await userEvent.click(screen.getByRole("button", { name: "搜尋" }));
    await waitFor(() => expect(requests).toContainEqual(["GET", "1", "travel"]));

    await userEvent.click(screen.getByRole("link", { name: "2" }));
    await waitFor(() => expect(requests).toContainEqual(["GET", "2", "travel"]));
    // 第一次載入沒有關鍵字
    expect(requests[0]).toEqual(["GET", "1", null]);
  });

  it("搜尋不到時顯示提示", async () => {
    useUserBackend({ users: [] });
    renderPage();

    await userEvent.type(screen.getByRole("searchbox", { name: "搜尋會員" }), "nobody");
    await userEvent.click(screen.getByRole("button", { name: "搜尋" }));

    expect(await screen.findByText("找不到符合「nobody」的會員")).toBeInTheDocument();
  });

  it("token 失效（401）時提示並導向登入頁", async () => {
    server.use(api.get("/api/admin/users", () => failure(401, "驗證錯誤, 請重新登入")));
    renderPage();

    expect(await findToast("取得資料失敗，請重新登入")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁");
  });
});
