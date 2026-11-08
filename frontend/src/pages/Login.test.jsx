import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";
import ProductedRoute from "../components/ProductedRoute";
import { api, failure } from "../test/contract";
import { server } from "../test/server";
import { Landing, renderRoutes } from "../test/render";
import { ADMIN_TOKEN as TOKEN } from "../test/fixtures";
const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;

const tokenInCookie = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE}=`))
    ?.split("=")[1];

const routes = [
  { path: "/login", element: <Login /> },
  {
    path: "/admin/products",
    element: (
      <ProductedRoute>
        <Landing name="後台產品頁" />
      </ProductedRoute>
    ),
  },
];

/** 記錄 /api/user/check 收到的 Authorization，valid 為 false 時回 401 */
const useUserCheck = (valid = true) => {
  const authorizations = [];
  server.use(
    api.post("/api/user/check", ({ request }) => {
      authorizations.push(request.headers.get("authorization"));
      return valid
        ? { json: { success: true, uid: "admin@gmail.com" } }
        : failure(401, "驗證錯誤, 請重新登入");
    }),
  );
  return authorizations;
};

const submitLogin = async (username, password) => {
  await userEvent.type(screen.getByLabelText("Email address"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "登入" }));
};

describe("登入頁", () => {
  it("登入成功後把 token 存進 cookie，並進入後台", async () => {
    let signinBody;
    server.use(
      api.post("/admin/signin", ({ body }) => {
        signinBody = body;
        return {
          json: {
            success: true,
            message: "登入成功",
            uid: "admin@gmail.com",
            token: TOKEN,
            expired: Date.now() + 7 * 24 * 60 * 60 * 1000, // 毫秒
          },
        };
      }),
    );
    const authorizations = useUserCheck();
    renderRoutes(routes, { route: "/login" });

    await submitLogin("admin@gmail.com", "Test123456");

    expect(await screen.findByTestId("landing")).toHaveTextContent("後台產品頁");
    expect(signinBody).toEqual({ username: "admin@gmail.com", password: "Test123456" });
    expect(tokenInCookie()).toBe(TOKEN);
    expect(authorizations.every((value) => value === TOKEN)).toBe(true);
  });

  it.each([
    [400, "登入失敗"],
    [429, "登入失敗次數過多，請 15 分鐘後再試"],
  ])("登入失敗（%i）時顯示後端原因", async (status, message) => {
    server.use(
      api.post("/admin/signin", () => ({
        ...failure(status, message),
        headers: status === 429 ? { "Retry-After": "900" } : undefined,
      })),
    );
    renderRoutes(routes, { route: "/login" });

    await submitLogin("admin@gmail.com", "WrongPassword");

    expect(await screen.findByRole("heading", { name: message })).toBeInTheDocument();
    expect(tokenInCookie()).toBeUndefined();
  });

  it("欄位格式錯誤時顯示原因", async () => {
    renderRoutes(routes, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email address"), "admin");
    await userEvent.type(screen.getByLabelText("Password"), "123");

    expect(await screen.findByText("Email 格式不正確")).toBeInTheDocument();
    expect(screen.getByText("密碼長度至少需 6 碼")).toBeInTheDocument();
  });

  it("已經登入時直接進入後台", async () => {
    document.cookie = `${COOKIE}=${TOKEN}; path=/`;
    const authorizations = useUserCheck();
    renderRoutes(routes, { route: "/login" });

    expect(await screen.findByTestId("landing")).toHaveTextContent("後台產品頁");
    expect(authorizations[0]).toBe(TOKEN);
  });

  it("cookie 裡的 token 已失效時清除 cookie，留在登入頁", async () => {
    document.cookie = `${COOKIE}=${TOKEN}; path=/`;
    const authorizations = useUserCheck(false);
    renderRoutes(routes, { route: "/login" });

    await expect.poll(() => authorizations.length).toBe(1);
    await expect.poll(tokenInCookie).toBeUndefined();
    expect(screen.getByRole("heading", { name: "請先登入" })).toBeInTheDocument();
  });
});

describe("後台路由保護", () => {
  it("沒有 token 時導向登入頁，不呼叫 API", async () => {
    renderRoutes(routes, { route: "/admin/products" });

    // 沒有定義 /api/user/check 的 handler，有呼叫的話契約檢查會失敗
    expect(await screen.findByRole("heading", { name: "請先登入" })).toBeInTheDocument();
  });

  it("token 有效時顯示後台頁面", async () => {
    document.cookie = `${COOKIE}=${TOKEN}; path=/`;
    const authorizations = useUserCheck();
    renderRoutes(routes, { route: "/admin/products" });

    expect(await screen.findByTestId("landing")).toHaveTextContent("後台產品頁");
    expect(authorizations).toEqual([TOKEN]);
  });

  it("token 失效時清除 cookie 並導向登入頁", async () => {
    document.cookie = `${COOKIE}=${TOKEN}; path=/`;
    useUserCheck(false);
    renderRoutes(routes, { route: "/admin/products" });

    expect(await screen.findByRole("heading", { name: "請先登入" })).toBeInTheDocument();
    expect(tokenInCookie()).toBeUndefined();
  });
});
