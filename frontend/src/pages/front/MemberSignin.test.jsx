import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router-dom";
import MemberSignin from "./MemberSignin";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { useCartMerge } from "../../test/handlers";
import { Landing, findToast, renderRoutes } from "../../test/render";
import {
  MEMBER_TOKEN,
  cartResponse,
  lineItem,
  memberUser,
  product,
  signinSuccess,
} from "../../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;

const tokenInCookie = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE}=`))
    ?.split("=")[1];

const routes = [
  { path: "/", element: <Landing name="首頁" /> },
  {
    path: "/product",
    element: (
      <>
        <Landing name="行程頁" />
        <Link to="/signin" state={{ from: "/product" }}>
          前往登入
        </Link>
      </>
    ),
  },
  { path: "/signin", element: <MemberSignin /> },
  { path: "/signup", element: <Landing name="註冊頁" /> },
];

const useMemberCheck = () =>
  server.use(
    api.post("/api/user/check", () => ({
      json: { success: true, ...memberUser() },
    })),
  );

const submit = async (email, password) => {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("密碼"), password);
  await userEvent.click(screen.getByRole("button", { name: "登入" }));
};

describe("會員登入頁", () => {
  it("登入成功後存下 token、顯示歡迎訊息並回到首頁", async () => {
    let body;
    server.use(
      api.post("/api/user/signin", ({ body: sent }) => {
        body = sent;
        return { json: signinSuccess(MEMBER_TOKEN) };
      }),
    );
    useMemberCheck();
    useCartMerge();
    renderRoutes(routes, { route: "/signin" });

    await submit("traveler@example.com", "Travel2026");

    expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
    expect(await findToast("歡迎回來，王小明")).toBeInTheDocument();
    expect(body).toEqual({ username: "traveler@example.com", password: "Travel2026" });
    expect(tokenInCookie()).toBe(MEMBER_TOKEN);
  });

  it("登入後把這個瀏覽器的訪客購物車併入帳號，並更新購物車", async () => {
    server.use(
      api.post("/api/user/signin", () => ({ json: signinSuccess(MEMBER_TOKEN) })),
    );
    useMemberCheck();
    const merges = useCartMerge([lineItem(product(), 2)]);
    const { store } = renderRoutes(routes, { route: "/signin" });

    await submit("traveler@example.com", "Travel2026");

    await screen.findByTestId("landing");
    expect(merges).toEqual([
      { cartId: localStorage.getItem("freetrav-cart-id"), authorization: MEMBER_TOKEN },
    ]);
    expect(merges[0].cartId).toMatch(/^[0-9a-f-]{36}$/);
    await expect.poll(() => store.getState().cart.carts.length).toBe(1);
  });

  it("合併購物車失敗時仍完成登入", async () => {
    server.use(
      api.post("/api/user/signin", () => ({ json: signinSuccess(MEMBER_TOKEN) })),
      api.post("/api/cart/merge", () => failure(400, "X-Cart-Id 格式不正確")),
      api.get("/api/cart", () => cartResponse([])),
    );
    useMemberCheck();
    renderRoutes(routes, { route: "/signin" });

    await submit("traveler@example.com", "Travel2026");

    expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
    expect(tokenInCookie()).toBe(MEMBER_TOKEN);
  });

  it("從其他頁面進來時，登入後回到那一頁", async () => {
    server.use(
      api.post("/api/user/signin", () => ({ json: signinSuccess(MEMBER_TOKEN) })),
    );
    useMemberCheck();
    useCartMerge();
    renderRoutes(routes, { route: "/product" });

    await userEvent.click(screen.getByRole("link", { name: "前往登入" }));
    await submit("traveler@example.com", "Travel2026");

    expect(await screen.findByTestId("landing")).toHaveTextContent("行程頁");
  });

  it.each([
    [400, "登入失敗"],
    [429, "登入失敗次數過多，請 15 分鐘後再試"],
  ])("登入失敗（%i）時顯示後端原因，不存 token", async (status, message) => {
    server.use(
      api.post("/api/user/signin", () => ({
        ...failure(status, message),
        headers: status === 429 ? { "Retry-After": "900" } : undefined,
      })),
    );
    renderRoutes(routes, { route: "/signin" });

    await submit("traveler@example.com", "Wrong2026");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(tokenInCookie()).toBeUndefined();
  });

  it("欄位空白或格式錯誤時不送出", async () => {
    // 沒有定義 /api/user/signin 的 handler，送出的話契約檢查會失敗
    renderRoutes(routes, { route: "/signin" });

    await userEvent.click(screen.getByRole("button", { name: "登入" }));
    expect(await screen.findByText("請輸入 Email")).toBeInTheDocument();
    expect(screen.getByText("請輸入密碼")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Email"), "traveler");
    expect(await screen.findByText("Email 格式不正確")).toBeInTheDocument();
  });

  it("已經登入時直接回到首頁", async () => {
    // Header 確認過登入狀態後，store 裡已經有帳號
    renderRoutes(routes, {
      route: "/signin",
      preloadedState: { auth: { user: memberUser() } },
    });

    expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
  });

  it("有註冊連結", () => {
    renderRoutes(routes, { route: "/signin" });

    expect(screen.getByRole("link", { name: "註冊會員" })).toHaveAttribute("href", "/signup");
  });
});
