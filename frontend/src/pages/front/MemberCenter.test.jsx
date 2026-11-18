import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import axios from "axios";
import MemberCenter from "./MemberCenter";
import OAuthCallback from "./OAuthCallback";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { Landing, findToast, renderRoutes } from "../../test/render";
import { installFakeGoogle, useGoogleEnabled } from "../../test/google";
import {
  interceptRedirects,
  returnFromProvider,
  useGitHubEnabled,
  useOAuthEnabled,
} from "../../test/oauth";
import {
  MEMBER_TOKEN,
  memberProfile,
  cartResponse,
  memberUser,
  signinSuccess,
} from "../../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;
const NEW_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJuZXcifQ.bmV3dG9rZW4";

const tokenInCookie = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE}=`))
    ?.split("=")[1];

/** 登入頁，顯示登入後要回到哪裡 */
const SigninLanding = () => {
  const location = useLocation();
  return <p data-testid="landing">登入頁 {location.state?.from}</p>;
};

/** 預設以一般會員進入（Header 已確認過登入狀態） */
const renderMemberCenter = (auth = { user: memberUser(), checked: true }, route = "/member") =>
  renderRoutes(
    [
      { path: "/", element: <Landing name="首頁" /> },
      { path: "/member", element: <MemberCenter /> },
      { path: "/signin", element: <SigninLanding /> },
      { path: "/oauth/callback", element: <OAuthCallback /> },
    ],
    { route, preloadedState: { auth } },
  );

const useProfile = (profile = memberProfile()) =>
  server.use(api.get("/api/user/profile", () => ({ json: { success: true, profile } })));

const profileCard = () =>
  screen.getByRole("heading", { name: "基本資料" }).closest("section");
const passwordCard = () =>
  screen.getByRole("heading", { name: /^(變更|設定)密碼$/ }).closest("section");
/** 會員資料載入後才有密碼卡片 */
const findPasswordCard = async () =>
  (await screen.findByRole("heading", { name: /^(變更|設定)密碼$/ })).closest("section");
const loginMethodsCard = async () =>
  (await screen.findByRole("heading", { name: "登入方式" })).closest("section");

const retype = async (label, text) => {
  const input = within(profileCard()).getByLabelText(label);
  await userEvent.clear(input);
  if (text) await userEvent.type(input, text);
};

/** 等會員資料載入，表單填入後才能操作 */
const waitForProfile = () =>
  waitFor(() => expect(screen.getByLabelText("Email")).toHaveValue("traveler@example.com"));

describe("會員中心的基本資料", () => {
  beforeEach(() => {
    axios.defaults.headers.common.Authorization = MEMBER_TOKEN;
  });

  it("顯示會員資料，email 不能修改", async () => {
    useProfile(memberProfile({ tel: "0912345678", address: "台北市信義區市府路1號" }));
    renderMemberCenter();

    await waitForProfile();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("姓名")).toHaveValue("王小明");
    expect(screen.getByLabelText("電話")).toHaveValue("0912345678");
    expect(screen.getByLabelText("地址")).toHaveValue("台北市信義區市府路1號");
  });

  it("儲存後顯示提示，Header 的姓名跟著更新", async () => {
    useProfile();
    let body;
    server.use(
      api.put("/api/user/profile", ({ body: sent }) => {
        body = sent;
        return {
          json: {
            success: true,
            message: "已更新會員資料",
            profile: memberProfile({ ...sent.data }),
          },
        };
      }),
    );
    const { store } = renderMemberCenter();
    await waitForProfile();

    await retype("姓名", "  王大明 ");
    await retype("電話", "0912345678");
    await retype("地址", "高雄市");
    await userEvent.click(screen.getByRole("button", { name: "儲存基本資料" }));

    expect(await findToast("已更新會員資料")).toBeInTheDocument();
    expect(body).toEqual({ data: { name: "王大明", tel: "0912345678", address: "高雄市" } });
    expect(store.getState().auth.user.name).toBe("王大明");
    expect(screen.getByLabelText("姓名")).toHaveValue("王大明");
  });

  it("清空電話與地址也可以儲存", async () => {
    useProfile(memberProfile({ tel: "0912345678", address: "高雄市" }));
    let body;
    server.use(
      api.put("/api/user/profile", ({ body: sent }) => {
        body = sent;
        return { json: { success: true, message: "已更新會員資料", profile: memberProfile() } };
      }),
    );
    renderMemberCenter();
    await waitFor(() => expect(screen.getByLabelText("電話")).toHaveValue("0912345678"));

    await retype("電話", "");
    await retype("地址", "");
    await userEvent.click(screen.getByRole("button", { name: "儲存基本資料" }));

    expect(await findToast("已更新會員資料")).toBeInTheDocument();
    expect(body.data).toMatchObject({ tel: "", address: "" });
  });

  it("欄位驗證失敗時顯示原因，不送出", async () => {
    useProfile();
    renderMemberCenter();
    await waitForProfile();

    await retype("姓名", "");
    await retype("電話", "09-1234-5678");
    await retype("地址", "址".repeat(101));
    await userEvent.click(screen.getByRole("button", { name: "儲存基本資料" }));

    expect(await screen.findByText("請輸入姓名")).toBeInTheDocument();
    expect(screen.getByText("電話需為 8–20 個數字")).toBeInTheDocument();
    expect(screen.getByText("地址不得超過 100 個字")).toBeInTheDocument();
    // 沒有定義 PUT /api/user/profile 的 handler，有送出的話契約檢查會失敗
  });

  it("後端拒絕時顯示原因", async () => {
    useProfile();
    server.use(api.put("/api/user/profile", () => failure(400, "tel 需為 8–20 個數字")));
    renderMemberCenter();
    await waitForProfile();

    await retype("電話", "0912345678");
    await userEvent.click(screen.getByRole("button", { name: "儲存基本資料" }));

    expect(await within(profileCard()).findByRole("alert")).toHaveTextContent("tel 需為 8–20 個數字");
  });

  it("讀不到會員資料時顯示原因", async () => {
    server.use(api.get("/api/user/profile", () => failure(500, "伺服器錯誤")));
    renderMemberCenter();

    await screen.findByRole("alert");
    expect(within(profileCard()).getByRole("alert")).toHaveTextContent("伺服器錯誤");
    expect(screen.queryByRole("button", { name: "儲存基本資料" })).not.toBeInTheDocument();
  });

  it("未登入時導向登入頁，登入後回到會員中心", async () => {
    renderMemberCenter({ user: null, checked: true });

    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁 /member");
    expect(await findToast("請先登入會員")).toBeInTheDocument();
  });

  it("登出後回到首頁，不被當成未登入導向登入頁", async () => {
    useProfile();
    server.use(
      api.post("/logout", () => ({ json: { success: true, message: "已登出" } })),
      // 登出後重新讀取（訪客的）購物車
      api.get("/api/cart", () => cartResponse([])),
    );
    const { store } = renderMemberCenter();
    await waitForProfile();

    await userEvent.click(screen.getByRole("button", { name: "登出" }));

    expect(await findToast("已登出")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
    expect(store.getState().auth.user).toBeNull();
    expect(screen.queryByText("請先登入會員")).not.toBeInTheDocument();
  });

  it("在其他頁登出後再開啟會員中心，仍導向登入頁", async () => {
    renderMemberCenter({ user: null, checked: true, signedOutFrom: "/product" });

    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁 /member");
    expect(await findToast("請先登入會員")).toBeInTheDocument();
  });

  it("確認登入狀態前不導向，也不讀取會員資料", async () => {
    // 沒有定義 GET /api/user/profile 的 handler，有呼叫的話契約檢查會失敗
    renderMemberCenter({ user: null, checked: false });

    expect(screen.getByRole("heading", { name: "會員中心" })).toBeInTheDocument();
    expect(screen.queryByTestId("landing")).not.toBeInTheDocument();
  });
});

describe("會員中心的變更密碼", () => {
  beforeEach(() => {
    axios.defaults.headers.common.Authorization = MEMBER_TOKEN;
    useProfile();
  });

  const fillPassword = async (current, next, confirm = next) => {
    const card = within(await findPasswordCard());
    await userEvent.type(card.getByLabelText("目前的密碼"), current);
    await userEvent.type(card.getByLabelText("新密碼"), next);
    await userEvent.type(card.getByLabelText("確認新密碼"), confirm);
    await userEvent.click(card.getByRole("button", { name: "變更密碼" }));
  };

  it("成功後改存新的 token 並清空表單", async () => {
    let body;
    let authorization;
    server.use(
      api.put("/api/user/password", ({ body: sent, request }) => {
        body = sent;
        authorization = request.headers.get("authorization");
        return { json: signinSuccess(NEW_TOKEN, { message: "已變更密碼" }) };
      }),
    );
    renderMemberCenter();

    await fillPassword("Travel2026", "Journey2027");

    expect(await findToast("已變更密碼，其他裝置需要重新登入")).toBeInTheDocument();
    expect(body).toEqual({ data: { password: "Travel2026", new_password: "Journey2027" } });
    expect(authorization).toBe(MEMBER_TOKEN);
    expect(tokenInCookie()).toBe(NEW_TOKEN);
    expect(axios.defaults.headers.common.Authorization).toBe(NEW_TOKEN);
    expect(within(passwordCard()).getByLabelText("目前的密碼")).toHaveValue("");
  });

  it("目前的密碼錯誤時顯示原因，保留原本的 token", async () => {
    server.use(api.put("/api/user/password", () => failure(400, "目前的密碼不正確")));
    renderMemberCenter();

    await fillPassword("Wrong2026", "Journey2027");

    expect(await within(passwordCard()).findByRole("alert")).toHaveTextContent("目前的密碼不正確");
    expect(axios.defaults.headers.common.Authorization).toBe(MEMBER_TOKEN);
  });

  it("鎖定時顯示等待時間", async () => {
    server.use(
      api.put("/api/user/password", () => ({
        ...failure(429, "登入失敗次數過多，請 15 分鐘後再試"),
        headers: { "Retry-After": "900" },
      })),
    );
    renderMemberCenter();

    await fillPassword("Wrong2026", "Journey2027");

    expect(await within(passwordCard()).findByRole("alert")).toHaveTextContent(
      "登入失敗次數過多，請 15 分鐘後再試",
    );
  });

  it("新密碼不符合規則、與目前相同或兩次不同時不送出", async () => {
    renderMemberCenter();
    const card = within(await findPasswordCard());

    await fillPassword("Travel2026", "short", "short");
    expect(
      await card.findByText("密碼需為 8–64 個英數或半形符號，且至少包含一個英文字母與一個數字", {
        selector: ".text-alert",
      }),
    ).toBeInTheDocument();

    await userEvent.clear(card.getByLabelText("新密碼"));
    await userEvent.type(card.getByLabelText("新密碼"), "Travel2026");
    expect(await card.findByText("新密碼不能與目前的密碼相同")).toBeInTheDocument();

    await userEvent.clear(card.getByLabelText("新密碼"));
    await userEvent.type(card.getByLabelText("新密碼"), "Journey2027");
    await userEvent.click(card.getByRole("button", { name: "變更密碼" }));
    expect(await card.findByText("兩次輸入的密碼不同")).toBeInTheDocument();
    // 沒有定義 PUT /api/user/password 的 handler，有送出的話契約檢查會失敗
  });
});

describe("會員中心的登入方式", () => {
  beforeEach(() => {
    axios.defaults.headers.common.Authorization = MEMBER_TOKEN;
    useGoogleEnabled();
  });

  it("有密碼、未連結：按 Google 連結後顯示已連結", async () => {
    useProfile();
    installFakeGoogle("link-credential");
    let body;
    server.use(
      api.post("/api/user/google/link", ({ body: sent }) => {
        body = sent;
        return {
          json: {
            success: true,
            message: "已連結 Google",
            profile: memberProfile({ identities: [{ provider: "google", email: "traveler@gmail.com" }] }),
          },
        };
      }),
    );
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    expect(card.getByText("已設定")).toBeInTheDocument();
    await userEvent.click(await card.findByRole("button", { name: /^Google / }));

    expect(await findToast("已連結 Google")).toBeInTheDocument();
    expect(body).toEqual({ data: { credential: "link-credential" } });
    expect(card.getByText("已連結（traveler@gmail.com）")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "解除連結 Google" })).toBeEnabled();
  });

  it("Google 帳號已連結其他會員時顯示原因", async () => {
    useProfile();
    installFakeGoogle();
    server.use(api.post("/api/user/google/link", () => failure(409, "這個 Google 帳號已連結其他會員")));
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    await userEvent.click(await card.findByRole("button", { name: /^Google / }));

    expect(await card.findByRole("alert")).toHaveTextContent("這個 Google 帳號已連結其他會員");
  });

  it("有密碼時可以解除連結", async () => {
    useProfile(memberProfile({ identities: [{ provider: "google", email: "traveler@gmail.com" }] }));
    server.use(
      api.delete("/api/user/google/link", () => ({
        json: { success: true, message: "已解除連結 Google", profile: memberProfile() },
      })),
    );
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    await userEvent.click(card.getByRole("button", { name: "解除連結 Google" }));

    expect(await findToast("已解除連結 Google")).toBeInTheDocument();
    expect(card.getByText("未連結。連結後可以直接用 Google 登入。")).toBeInTheDocument();
  });

  it("只用 Google 登入的帳號不能解除連結，密碼卡片是設定密碼", async () => {
    useProfile(memberProfile({ has_password: false, identities: [{ provider: "google", email: "traveler@gmail.com" }] }));
    installFakeGoogle();
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    expect(card.getByText("未設定")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "解除連結 Google" })).toBeDisabled();
    expect(card.getByText("至少要保留一種登入方式，請先設定密碼才能解除連結")).toBeInTheDocument();

    const password = within(await findPasswordCard());
    expect(password.getByRole("heading", { name: "設定密碼" })).toBeInTheDocument();
    expect(password.queryByLabelText("目前的密碼")).not.toBeInTheDocument();
    expect(password.queryByRole("button", { name: "變更密碼" })).not.toBeInTheDocument();
  });

  it("設定密碼：填好新密碼後以 Google 重新驗證，存下新的 token", async () => {
    const NEW_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZXQifQ.c2V0dG9rZW4";
    useProfile(memberProfile({ has_password: false, identities: [{ provider: "google", email: "traveler@gmail.com" }] }));
    installFakeGoogle("fresh-credential");
    let body;
    server.use(
      api.put("/api/user/password", ({ body: sent }) => {
        body = sent;
        return { json: signinSuccess(NEW_TOKEN, { message: "已設定密碼" }) };
      }),
    );
    renderMemberCenter();

    const card = within(await findPasswordCard());
    await userEvent.type(card.getByLabelText("新密碼"), "Journey2027");
    await userEvent.type(card.getByLabelText("確認新密碼"), "Journey2027");
    await userEvent.click(await card.findByRole("button", { name: /^Google / }));

    expect(await findToast("已設定密碼，現在也可以用 Email 與密碼登入")).toBeInTheDocument();
    expect(body).toEqual({ data: { credential: "fresh-credential", new_password: "Journey2027" } });
    expect(tokenInCookie()).toBe(NEW_TOKEN);
    // 設定後變成一般的變更密碼，也可以解除 Google
    expect(await screen.findByRole("heading", { name: "變更密碼" })).toBeInTheDocument();
    expect(within(await loginMethodsCard()).getByRole("button", { name: "解除連結 Google" })).toBeEnabled();
  });

  it("設定密碼前先檢查欄位，不符合時不送出", async () => {
    useProfile(memberProfile({ has_password: false, identities: [{ provider: "google", email: "traveler@gmail.com" }] }));
    installFakeGoogle();
    renderMemberCenter();

    const card = within(await findPasswordCard());
    await userEvent.click(await card.findByRole("button", { name: /^Google / }));

    expect(await card.findByText("請輸入新密碼")).toBeInTheDocument();
    expect(card.getByText("請再輸入一次新密碼")).toBeInTheDocument();
    // 沒有定義 PUT /api/user/password 的 handler，有送出的話契約檢查會失敗
  });
});

describe("會員中心的 GitHub", () => {
  const GITHUB = { provider: "github", email: "traveler@example.com" };
  const NEW_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJnaCJ9.Z2l0aHVidG9rZW4";

  beforeEach(() => {
    axios.defaults.headers.common.Authorization = MEMBER_TOKEN;
    useGitHubEnabled();
  });

  /** 在會員中心按下按鈕導向 GitHub，再模擬授權後回到回呼頁 */
  const authorizeOnGitHub = async (buttonName, code = "github-code") => {
    const urls = interceptRedirects();
    const view = renderMemberCenter();
    await userEvent.click(await screen.findByRole("button", { name: buttonName }));
    await waitFor(() => expect(urls).toHaveLength(1));
    view.unmount();
    returnFromProvider(urls[0], { code });
    return renderMemberCenter(undefined, "/oauth/callback");
  };

  it("後端沒有設定 GitHub 時不顯示", async () => {
    server.use(
      api.get("/api/user/oauth/config", () => ({
        json: {
          success: true,
          providers: Object.fromEntries(
            ["github", "facebook"].map((p) => [
              p,
              { enabled: false, client_id: "", authorize_url: "", scope: "" },
            ]),
          ),
        },
      })),
    );
    useProfile();
    renderMemberCenter();

    await loginMethodsCard();
    await waitFor(() => expect(screen.queryByText("GitHub")).not.toBeInTheDocument());
  });

  it("連結 GitHub：授權後送出 code，回到會員中心顯示已連結", async () => {
    let linked = false;
    server.use(
      api.get("/api/user/profile", () => ({
        json: { success: true, profile: memberProfile({ identities: linked ? [GITHUB] : [] }) },
      })),
    );
    let body;
    server.use(
      api.post("/api/user/oauth/{provider}/link", ({ body: sent }) => {
        body = sent;
        linked = true;
        return {
          json: { success: true, message: "已連結 GitHub", profile: memberProfile({ identities: [GITHUB] }) },
        };
      }),
    );

    await authorizeOnGitHub("連結 GitHub", "link-code");

    expect(await findToast("已連結 GitHub")).toBeInTheDocument();
    expect(body.data).toMatchObject({ code: "link-code", redirect_uri: `${window.location.origin}/` });
    const card = within(await loginMethodsCard());
    expect(await card.findByText("已連結（traveler@example.com）")).toBeInTheDocument();
  });

  it("連結失敗（已連結其他會員）時回到會員中心顯示原因", async () => {
    useProfile();
    server.use(
      api.post("/api/user/oauth/{provider}/link", () => failure(409, "這個 GitHub 帳號已連結其他會員")),
    );

    await authorizeOnGitHub("連結 GitHub");

    expect(await findToast("這個 GitHub 帳號已連結其他會員")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "會員中心" })).toBeInTheDocument();
  });

  it("有密碼時可以解除 GitHub；沒有 email 的連結只顯示已連結", async () => {
    useProfile(memberProfile({ identities: [{ provider: "github", email: null }] }));
    let provider;
    server.use(
      api.delete("/api/user/oauth/{provider}/link", ({ params }) => {
        provider = params.provider;
        return { json: { success: true, message: "已解除連結 GitHub", profile: memberProfile() } };
      }),
    );
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    expect(await card.findByText("已連結")).toBeInTheDocument();
    await userEvent.click(card.getByRole("button", { name: "解除連結 GitHub" }));

    expect(await findToast("已解除連結 GitHub")).toBeInTheDocument();
    expect(provider).toBe("github");
    expect(card.getByRole("button", { name: "連結 GitHub" })).toBeInTheDocument();
  });

  it("沒有密碼但還連結了 Google 時可以解除 GitHub，Google 是最後一種時不行", async () => {
    useGoogleEnabled();
    installFakeGoogle();
    useProfile(
      memberProfile({
        has_password: false,
        identities: [{ provider: "google", email: "g@gmail.com" }, GITHUB],
      }),
    );
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    expect(card.getByRole("button", { name: "解除連結 GitHub" })).toBeEnabled();
    expect(card.getByRole("button", { name: "解除連結 Google" })).toBeEnabled();
    expect(card.queryByText("至少要保留一種登入方式，請先設定密碼才能解除連結")).not.toBeInTheDocument();
  });

  it("只用 GitHub 的帳號：不能解除，設定密碼要先以 GitHub 驗證", async () => {
    useProfile(memberProfile({ has_password: false, identities: [GITHUB] }));
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    expect(card.getByRole("button", { name: "解除連結 GitHub" })).toBeDisabled();
    const password = within(await findPasswordCard());
    expect(password.getByRole("heading", { name: "設定密碼" })).toBeInTheDocument();
    // 驗證前不顯示密碼欄位：離開網站時填好的密碼會消失
    expect(password.queryByLabelText("新密碼")).not.toBeInTheDocument();
    expect(await password.findByRole("button", { name: "以 GitHub 驗證身分" })).toBeInTheDocument();
  });

  it("設定密碼：以 GitHub 驗證後回到會員中心填寫新密碼，送出 code 並存下新的 token", async () => {
    useProfile(memberProfile({ has_password: false, identities: [GITHUB] }));
    let body;
    server.use(
      api.put("/api/user/password", ({ body: sent }) => {
        body = sent;
        return { json: signinSuccess(NEW_TOKEN, { message: "已設定密碼" }) };
      }),
    );

    await authorizeOnGitHub("以 GitHub 驗證身分", "password-code");

    const card = within(await findPasswordCard());
    expect(card.getByText(/已通過 GitHub 驗證/)).toBeInTheDocument();
    await userEvent.type(card.getByLabelText("新密碼"), "Journey2027");
    await userEvent.type(card.getByLabelText("確認新密碼"), "Journey2027");
    await userEvent.click(card.getByRole("button", { name: "設定密碼" }));

    expect(await findToast("已設定密碼，現在也可以用 Email 與密碼登入")).toBeInTheDocument();
    expect(body).toEqual({
      data: {
        oauth: {
          provider: "github",
          code: "password-code",
          redirect_uri: `${window.location.origin}/`,
          code_verifier: expect.stringMatching(/^[\w-]{43}$/),
        },
        new_password: "Journey2027",
      },
    });
    expect(tokenInCookie()).toBe(NEW_TOKEN);
  });

  it("設定密碼失敗時顯示原因，要重新驗證（code 只能用一次）", async () => {
    useProfile(memberProfile({ has_password: false, identities: [GITHUB] }));
    server.use(
      api.put("/api/user/password", () =>
        failure(400, "GitHub 驗證失敗，請以已連結的 GitHub 帳號驗證"),
      ),
    );

    await authorizeOnGitHub("以 GitHub 驗證身分");

    const card = within(await findPasswordCard());
    await userEvent.type(card.getByLabelText("新密碼"), "Journey2027");
    await userEvent.type(card.getByLabelText("確認新密碼"), "Journey2027");
    await userEvent.click(card.getByRole("button", { name: "設定密碼" }));

    expect(await card.findByRole("alert")).toHaveTextContent(
      "GitHub 驗證失敗，請以已連結的 GitHub 帳號驗證",
    );
    expect(card.getByRole("button", { name: "以 GitHub 驗證身分" })).toBeInTheDocument();
    expect(tokenInCookie()).toBeUndefined();
  });
});

describe("會員中心的 Facebook", () => {
  beforeEach(() => {
    axios.defaults.headers.common.Authorization = MEMBER_TOKEN;
    useOAuthEnabled(["github", "facebook"]);
  });

  it("GitHub 與 Facebook 各一列：已連結的可以解除，未連結的可以連結", async () => {
    useProfile(memberProfile({ identities: [{ provider: "facebook", email: null }] }));
    renderMemberCenter();

    const card = within(await loginMethodsCard());
    expect(await card.findByRole("button", { name: "連結 GitHub" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "解除連結 Facebook" })).toBeEnabled();
    expect(card.getByText("已連結")).toBeInTheDocument();
  });

  it("只用 Facebook 的帳號：設定密碼要先以 Facebook 驗證，導向時用途是設定密碼", async () => {
    useProfile(memberProfile({ has_password: false, identities: [{ provider: "facebook", email: "a@example.com" }] }));
    const urls = interceptRedirects();
    renderMemberCenter();

    const password = within(await findPasswordCard());
    expect(password.queryByRole("button", { name: "以 GitHub 驗證身分" })).not.toBeInTheDocument();
    await userEvent.click(await password.findByRole("button", { name: "以 Facebook 驗證身分" }));

    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0].host).toBe("www.facebook.com");
    expect(JSON.parse(sessionStorage.getItem("freetrav-oauth"))).toMatchObject({
      provider: "facebook",
      purpose: "password",
      returnTo: "/member",
    });
  });
});
