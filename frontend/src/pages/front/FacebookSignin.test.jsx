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
import {
  FACEBOOK_APP_ID,
  FACEBOOK_AUTHORIZE_URL,
  interceptRedirects,
  returnFromProvider,
  useFacebookEnabled,
  useOAuthEnabled,
} from "../../test/oauth";
import { MEMBER_TOKEN, memberUser, signinSuccess } from "../../test/fixtures";

// 授權碼流程與 GitHub 共用（GitHubSignin.test.jsx 測過 state、重新整理等），這裡測 Facebook 的差異
const Page = () => <p data-testid="landing">{useLocation().pathname}</p>;

const routes = [
  { path: "/", element: <Page /> },
  { path: "/signin", element: <MemberSignin /> },
  { path: "/signup", element: <MemberSignup /> },
  { path: "/oauth/callback", element: <OAuthCallback /> },
];

const renderAt = (route) =>
  renderRoutes(routes, { route, preloadedState: { auth: { user: null, checked: true } } });

const clickFacebook = async (page = "/signin", name = "使用 Facebook 登入") => {
  const urls = interceptRedirects();
  const view = renderAt(page);
  await userEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(urls).toHaveLength(1));
  view.unmount();
  return urls[0];
};

const useFacebookBackend = (respond) => {
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

describe("Facebook 登入與註冊", () => {
  it("GitHub 與 Facebook 都啟用時兩個按鈕都顯示", async () => {
    useOAuthEnabled(["github", "facebook"]);
    renderAt("/signup");

    expect(await screen.findByRole("button", { name: "使用 GitHub 註冊" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "使用 Facebook 註冊" })).toBeInTheDocument();
  });

  it("授權網址帶 App ID 與 email 權限，不用 PKCE", async () => {
    useFacebookEnabled();
    const url = await clickFacebook();

    expect(`${url.origin}${url.pathname}`).toBe(FACEBOOK_AUTHORIZE_URL);
    expect(url.searchParams.get("client_id")).toBe(FACEBOOK_APP_ID);
    expect(url.searchParams.get("scope")).toBe("email");
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/`);
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("授權後登入：送出 code 與 redirect_uri（沒有 code_verifier），回到首頁", async () => {
    useFacebookEnabled();
    const requests = useFacebookBackend(() => ({
      json: signinSuccess(MEMBER_TOKEN, { message: "註冊成功" }),
    }));
    useCartMerge();
    returnFromProvider(await clickFacebook(), { code: "facebook-code" });
    renderAt("/oauth/callback");

    expect(await findToast("註冊成功，歡迎 王小明")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("/");
    expect(requests).toEqual([
      {
        provider: "facebook",
        body: { data: { code: "facebook-code", redirect_uri: `${window.location.origin}/` } },
      },
    ]);
  });

  it("Facebook 沒有提供 email 時回登入頁顯示原因", async () => {
    useFacebookEnabled();
    useFacebookBackend(() => failure(400, "Facebook 沒有提供 Email，請改用其他方式註冊"));
    returnFromProvider(await clickFacebook());
    renderAt("/oauth/callback");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Facebook 沒有提供 Email，請改用其他方式註冊",
    );
  });

  it("在 Facebook 取消授權", async () => {
    useFacebookEnabled();
    returnFromProvider(await clickFacebook(), { error: "access_denied" });
    renderAt("/oauth/callback");

    expect(await screen.findByRole("alert")).toHaveTextContent("已取消 Facebook 授權");
  });
});
