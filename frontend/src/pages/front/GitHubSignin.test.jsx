import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import MemberSignin from "./MemberSignin";
import MemberSignup from "./MemberSignup";
import OAuthCallback from "./OAuthCallback";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { useCartMerge } from "../../test/handlers";
import { findToast, renderRoutes } from "../../test/render";
import { interceptRedirects, returnFromProvider, useGitHubEnabled } from "../../test/oauth";
import { MEMBER_TOKEN, memberUser, signinSuccess } from "../../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;

const tokenInCookie = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE}=`))
    ?.split("=")[1];

/** 登入後回到的頁面，顯示路徑 */
const Page = () => <p data-testid="landing">{useLocation().pathname}</p>;

const routes = [
  { path: "/", element: <Page /> },
  { path: "/cartform", element: <Page /> },
  { path: "/signin", element: <MemberSignin /> },
  { path: "/signup", element: <MemberSignup /> },
  { path: "/oauth/callback", element: <OAuthCallback /> },
];

/** 未登入、Header 已確認過登入狀態 */
const renderAt = (route, state) =>
  renderRoutes(routes, { route, preloadedState: { auth: { user: null, checked: true, ...state } } });

/** 在登入頁按下 GitHub 按鈕，回傳授權網址 */
const clickGitHub = async (page = "/signin", name = "使用 GitHub 登入") => {
  const urls = interceptRedirects();
  const view = renderAt(page);
  await userEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(urls).toHaveLength(1));
  view.unmount();
  return urls[0];
};

/** 模擬 POST /api/user/oauth/github，記錄送出的 body */
const useGitHubBackend = (respond) => {
  const requests = [];
  server.use(
    api.post("/api/user/oauth/{provider}", ({ params, body }) => {
      requests.push({ provider: params.provider, body });
      return respond();
    }),
    api.post("/api/user/check", () => ({ json: { success: true, ...memberUser() } })),
  );
  return requests;
};

describe("GitHub 登入與註冊", () => {
  it("後端沒有設定 GitHub 登入時不顯示按鈕", async () => {
    renderAt("/signin");

    await screen.findByRole("button", { name: "登入" });
    await waitFor(() => expect(screen.queryByText("或")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /GitHub/ })).not.toBeInTheDocument();
  });

  it("只有 GitHub 啟用時也顯示分隔線；註冊頁的文字是註冊", async () => {
    useGitHubEnabled();
    renderAt("/signup");

    expect(await screen.findByRole("button", { name: "使用 GitHub 註冊" })).toBeInTheDocument();
    expect(screen.getByText("或")).toBeInTheDocument();
  });

  it("按下按鈕導向 GitHub 的授權頁", async () => {
    useGitHubEnabled();
    const url = await clickGitHub();

    expect(url.host).toBe("github.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/`);
  });

  it("授權後登入：送出 code、存下 token、合併訪客購物車、回到原本的頁面", async () => {
    useGitHubEnabled();
    const requests = useGitHubBackend(() => ({ json: signinSuccess(MEMBER_TOKEN) }));
    const merges = useCartMerge();
    // 從填寫資料頁被導到登入頁
    const urls = interceptRedirects();
    const view = renderRoutes(routes, {
      route: { pathname: "/signin", state: { from: "/cartform" } },
      preloadedState: { auth: { user: null, checked: true } },
    });
    await userEvent.click(await screen.findByRole("button", { name: "使用 GitHub 登入" }));
    await waitFor(() => expect(urls).toHaveLength(1));
    view.unmount();

    returnFromProvider(urls[0], { code: "code-from-github" });
    renderAt("/oauth/callback");

    expect(await findToast("歡迎回來，王小明")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("/cartform");
    expect(requests).toEqual([
      {
        provider: "github",
        body: {
          data: {
            code: "code-from-github",
            redirect_uri: `${window.location.origin}/`,
            code_verifier: expect.stringMatching(/^[\w-]{43}$/),
          },
        },
      },
    ]);
    expect(tokenInCookie()).toBe(MEMBER_TOKEN);
    expect(merges).toHaveLength(1);
  });

  it("新的 GitHub 帳號建立會員時顯示註冊成功", async () => {
    useGitHubEnabled();
    useGitHubBackend(() => ({ json: signinSuccess(MEMBER_TOKEN, { message: "註冊成功" }) }));
    useCartMerge();
    returnFromProvider(await clickGitHub("/signup", "使用 GitHub 註冊"));
    renderAt("/oauth/callback");

    expect(await findToast("註冊成功，歡迎 王小明")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("/");
  });

  it("email 已有帳號（409）時回登入頁顯示原因，不存 token", async () => {
    useGitHubEnabled();
    useGitHubBackend(() =>
      failure(409, "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 GitHub"),
    );
    returnFromProvider(await clickGitHub());
    renderAt("/oauth/callback");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 GitHub",
    );
    expect(screen.getByRole("heading", { name: "會員登入" })).toBeInTheDocument();
    expect(tokenInCookie()).toBeUndefined();
  });

  it("沒有已驗證的 email 時回登入頁顯示原因", async () => {
    useGitHubEnabled();
    useGitHubBackend(() => failure(400, "GitHub 帳號沒有已驗證的 Email，請改用其他方式註冊"));
    returnFromProvider(await clickGitHub());
    renderAt("/oauth/callback");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub 帳號沒有已驗證的 Email，請改用其他方式註冊",
    );
  });

  it("state 不符時不送出 code", async () => {
    useGitHubEnabled();
    returnFromProvider(await clickGitHub(), { state: "forged" });
    renderAt("/oauth/callback");

    // 沒有定義 POST /api/user/oauth/{provider}，有送出的話契約檢查會失敗
    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub 驗證失敗，請重新操作一次");
  });

  it("在 GitHub 取消授權", async () => {
    useGitHubEnabled();
    returnFromProvider(await clickGitHub(), { error: "access_denied" });
    renderAt("/oauth/callback");

    expect(await screen.findByRole("alert")).toHaveTextContent("已取消 GitHub 授權");
  });

  it("直接開啟或重新整理回呼頁", async () => {
    renderAt("/oauth/callback");

    expect(await screen.findByRole("alert")).toHaveTextContent("登入流程已失效，請重新操作一次");
  });

  it("確認登入狀態前不處理", async () => {
    useGitHubEnabled();
    returnFromProvider(await clickGitHub());
    renderAt("/oauth/callback", { checked: false });

    expect(screen.getByRole("status")).toHaveTextContent("正在處理登入");
    // 沒有定義 POST 的 handler，有送出的話契約檢查會失敗
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
