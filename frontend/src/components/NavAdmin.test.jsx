import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { HttpResponse, http } from "msw";
import NavAdmin from "./NavAdmin";
import { api, API_BASE } from "../test/contract";
import { server } from "../test/server";
import { Landing, renderRoutes, signInAsAdmin } from "../test/render";
import { ADMIN_TOKEN } from "../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;

const renderNav = () =>
  renderRoutes(
    [
      { path: "/admin/products", element: <NavAdmin /> },
      { path: "/login", element: <Landing name="登入頁" /> },
    ],
    { route: "/admin/products" },
  );

describe("後台導覽列", () => {
  beforeEach(() => {
    signInAsAdmin();
    document.cookie = `${COOKIE}=${ADMIN_TOKEN}; path=/`;
  });

  it("登出時呼叫 /logout 撤銷 token，清除 cookie 並導向登入頁", async () => {
    let authorization;
    server.use(
      api.post("/logout", ({ request }) => {
        authorization = request.headers.get("authorization");
        return { json: { success: true, message: "已登出" } };
      }),
    );
    renderNav();

    await userEvent.click(screen.getByRole("button", { name: "登出" }));

    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁");
    expect(authorization).toBe(ADMIN_TOKEN);
    expect(document.cookie).not.toContain(`${COOKIE}=`);
    expect(axios.defaults.headers.common.Authorization).toBeUndefined();
  });

  it("網路錯誤時仍清除本機的 token", async () => {
    // 模擬連不上伺服器，不經過契約檢查
    server.use(http.post(`${API_BASE}/logout`, () => HttpResponse.error()));
    renderNav();

    await userEvent.click(screen.getByRole("button", { name: "登出" }));

    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁");
    expect(document.cookie).not.toContain(`${COOKIE}=`);
  });

  it("列出五個後台頁面的連結", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "後台產品列表" })).toHaveAttribute("href", "/admin/products");
    expect(screen.getByRole("link", { name: "後台訂單列表" })).toHaveAttribute("href", "/admin/orders");
    expect(screen.getByRole("link", { name: "文章列表" })).toHaveAttribute("href", "/admin/articles");
    expect(screen.getByRole("link", { name: "優惠券列表" })).toHaveAttribute("href", "/admin/coupons");
    expect(screen.getByRole("link", { name: "會員列表" })).toHaveAttribute("href", "/admin/users");
  });
});
