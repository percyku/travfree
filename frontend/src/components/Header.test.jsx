import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";
import MemberCenter from "../pages/front/MemberCenter";
import CartForm from "../pages/front/CartForm";
import { api } from "../test/contract";
import { server } from "../test/server";
import { Landing, findToast, renderRoutes } from "../test/render";
import {
  MEMBER_TOKEN,
  adminUser,
  cartResponse,
  memberProfile,
  memberUser,
  pagination,
} from "../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;

const renderHeader = () =>
  renderRoutes([{ path: "/", element: <Header /> }], { route: "/" });

const signedInAs = (user) => {
  document.cookie = `${COOKIE}=${MEMBER_TOKEN}; path=/`;
  server.use(
    api.post("/api/user/check", () => ({ json: { success: true, ...user } })),
  );
};

describe("前台 Header 的會員狀態", () => {
  beforeEach(() => {
    // Header 掛載時會讀取購物車與文章
    server.use(
      api.get("/api/cart", () => cartResponse([])),
      api.get("/api/articles", () => ({
        json: {
          success: true,
          articles: [],
          pagination: pagination({ total_pages: 0, current_page: 0 }),
          messages: [],
        },
      })),
    );
  });

  it("未登入時顯示登入與註冊，不呼叫 /api/user/check", async () => {
    // 沒有定義 /api/user/check 的 handler，有呼叫的話契約檢查會失敗
    renderHeader();

    expect(screen.getByRole("link", { name: "登入" })).toHaveAttribute("href", "/signin");
    expect(screen.getByRole("link", { name: "註冊" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("button", { name: "登出" })).not.toBeInTheDocument();
  });

  it("一般會員顯示姓名與登出，沒有後台連結", async () => {
    signedInAs(memberUser());
    renderHeader();

    expect(await screen.findByText("王小明")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "會員中心" })).toHaveAttribute("href", "/member");
    expect(screen.getByRole("link", { name: "會員中心" })).toHaveTextContent("王小明");
    expect(screen.getByRole("button", { name: "登出" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登入" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "後台" })).not.toBeInTheDocument();
  });

  it("管理者多一個後台連結", async () => {
    signedInAs(adminUser());
    renderHeader();

    expect(await screen.findByRole("link", { name: "後台" })).toHaveAttribute(
      "href",
      "/admin/products",
    );
  });

  it("登出時撤銷 token、清除 cookie，並恢復登入連結", async () => {
    signedInAs(memberUser());
    let authorization;
    server.use(
      api.post("/logout", ({ request }) => {
        authorization = request.headers.get("authorization");
        return { json: { success: true, message: "已登出" } };
      }),
    );
    renderHeader();

    await userEvent.click(await screen.findByRole("button", { name: "登出" }));

    expect(await findToast("已登出")).toBeInTheDocument();
    expect(authorization).toBe(MEMBER_TOKEN);
    expect(document.cookie).not.toContain(`${COOKIE}=`);
    expect(screen.getByRole("link", { name: "登入" })).toBeInTheDocument();
    expect(screen.queryByText("王小明")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "會員中心" })).not.toBeInTheDocument();
  });

  // 用真正的會員中心與填寫資料頁：它們在未登入時會導向登入頁，主動登出不能被當成未登入
  it.each([
    ["/member", <MemberCenter key="member" />],
    ["/cartform", <CartForm key="cartform" />],
  ])("在 %s 登出時回到首頁，不被導向登入頁", async (path, page) => {
    signedInAs(memberUser());
    server.use(
      api.post("/logout", () => ({ json: { success: true, message: "已登出" } })),
      api.get("/api/user/profile", () => ({ json: { success: true, profile: memberProfile() } })),
    );
    renderRoutes(
      [
        { path: "/", element: <><Header /><Landing name="首頁" /></> },
        { path, element: <><Header />{page}</> },
        { path: "/signin", element: <Landing name="登入頁" /> },
      ],
      { route: path },
    );

    // 會員中心頁本身也有登出，這裡按 Header 的
    const header = (await screen.findAllByRole("navigation"))[0];
    await userEvent.click(await within(header).findByRole("button", { name: "登出" }));

    expect(await findToast("已登出")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
    expect(screen.queryByText(/請先登入會員/)).not.toBeInTheDocument();
  });
});
