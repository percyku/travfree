import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import axios from "axios";
import MemberCenter from "./MemberCenter";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { Landing, findToast, renderRoutes } from "../../test/render";
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
const renderMemberCenter = (auth = { user: memberUser(), checked: true }) =>
  renderRoutes(
    [
      { path: "/", element: <Landing name="首頁" /> },
      { path: "/member", element: <MemberCenter /> },
      { path: "/signin", element: <SigninLanding /> },
    ],
    { route: "/member", preloadedState: { auth } },
  );

const useProfile = (profile = memberProfile()) =>
  server.use(api.get("/api/user/profile", () => ({ json: { success: true, profile } })));

const profileCard = () =>
  screen.getByRole("heading", { name: "基本資料" }).closest("section");
const passwordCard = () =>
  screen.getByRole("heading", { name: "變更密碼" }).closest("section");

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

    expect(await within(profileCard()).findByRole("alert")).toHaveTextContent("伺服器錯誤");
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
    const card = within(passwordCard());
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
    const card = within(passwordCard());

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
