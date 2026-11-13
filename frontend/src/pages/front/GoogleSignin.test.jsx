import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberSignin from "./MemberSignin";
import MemberSignup from "./MemberSignup";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { useCartMerge } from "../../test/handlers";
import { Landing, findToast, renderRoutes } from "../../test/render";
import { GOOGLE_CLIENT_ID, installFakeGoogle, useGoogleEnabled } from "../../test/google";
import { MEMBER_TOKEN, memberUser, signinSuccess } from "../../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;
const CREDENTIAL = "google-id-token-for-test";

const tokenInCookie = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE}=`))
    ?.split("=")[1];

const renderPage = (path) =>
  renderRoutes(
    [
      { path: "/", element: <Landing name="首頁" /> },
      { path: "/signin", element: <MemberSignin /> },
      { path: "/signup", element: <MemberSignup /> },
    ],
    { route: path },
  );

/** 模擬 POST /api/user/google，記錄送出的 body */
const useGoogleBackend = (respond) => {
  const requests = [];
  server.use(
    api.post("/api/user/google", ({ body }) => {
      requests.push(body);
      return respond();
    }),
    api.post("/api/user/check", () => ({ json: { success: true, ...memberUser() } })),
  );
  return requests;
};

const googleButton = () => screen.findByRole("button", { name: /^Google / });

describe("Google 登入與註冊", () => {
  it("後端沒有設定 Google 登入時不顯示按鈕", async () => {
    // test/server.js 的預設：enabled false
    installFakeGoogle();
    renderPage("/signin");

    await screen.findByRole("button", { name: "登入" });
    await waitFor(() => expect(screen.queryByText("或")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^Google / })).not.toBeInTheDocument();
  });

  describe("後端已設定", () => {
    beforeEach(() => {
      useGoogleEnabled();
    });

    it("以後端給的 client ID 初始化 GIS", async () => {
      const google = installFakeGoogle();
      renderPage("/signin");

      expect(await googleButton()).toHaveTextContent("Google signin_with");
      expect(google.initialized[0].client_id).toBe(GOOGLE_CLIENT_ID);
    });

    it("已連結的 Google 帳號登入：存下 token、合併訪客購物車、回到首頁", async () => {
      installFakeGoogle(CREDENTIAL);
      const requests = useGoogleBackend(() => ({ json: signinSuccess(MEMBER_TOKEN) }));
      const merges = useCartMerge();
      renderPage("/signin");

      await userEvent.click(await googleButton());

      expect(await findToast("歡迎回來，王小明")).toBeInTheDocument();
      expect(requests).toEqual([{ data: { credential: CREDENTIAL } }]);
      expect(tokenInCookie()).toBe(MEMBER_TOKEN);
      expect(merges).toHaveLength(1);
      expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
    });

    it("新的 Google 帳號建立會員，註冊頁顯示註冊成功", async () => {
      installFakeGoogle(CREDENTIAL);
      useGoogleBackend(() => ({ json: signinSuccess(MEMBER_TOKEN, { message: "註冊成功" }) }));
      useCartMerge();
      renderPage("/signup");

      expect(await googleButton()).toHaveTextContent("Google signup_with");
      await userEvent.click(await googleButton());

      expect(await findToast("註冊成功，歡迎 王小明")).toBeInTheDocument();
    });

    it("email 已有帳號（409）時顯示原因，不存 token", async () => {
      installFakeGoogle(CREDENTIAL);
      useGoogleBackend(() =>
        failure(409, "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Google"),
      );
      renderPage("/signin");

      await userEvent.click(await googleButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Google",
      );
      expect(tokenInCookie()).toBeUndefined();
      expect(screen.queryByTestId("landing")).not.toBeInTheDocument();
    });

    it("登入頁提示用 Google 註冊的帳號改用 Google 登入", async () => {
      installFakeGoogle();
      renderPage("/signin");

      expect(await screen.findByText("用 Google 註冊的帳號請使用 Google 登入")).toBeInTheDocument();
    });
  });
});
