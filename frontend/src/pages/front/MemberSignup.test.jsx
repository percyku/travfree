import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberSignup from "./MemberSignup";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import { Landing, findToast, renderRoutes } from "../../test/render";
import { MEMBER_TOKEN, memberUser, signinSuccess } from "../../test/fixtures";

const COOKIE = import.meta.env.VITE_APP_TOKEN_NAME;
const PASSWORD_RULE =
  "密碼需為 8–64 個英數或半形符號，且至少包含一個英文字母與一個數字";

const routes = [
  { path: "/", element: <Landing name="首頁" /> },
  { path: "/signup", element: <MemberSignup /> },
  { path: "/signin", element: <Landing name="登入頁" /> },
];

const fill = async ({ name, email, password, confirm = password }) => {
  if (name) await userEvent.type(screen.getByLabelText("姓名"), name);
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  if (password) await userEvent.type(screen.getByLabelText("密碼"), password);
  if (confirm) await userEvent.type(screen.getByLabelText("確認密碼"), confirm);
};

const submit = () => userEvent.click(screen.getByRole("button", { name: "註冊" }));

describe("會員註冊頁", () => {
  it("註冊成功後直接是登入狀態，回到首頁", async () => {
    let body;
    server.use(
      api.post("/api/user/signup", ({ body: sent }) => {
        body = sent;
        return { json: signinSuccess(MEMBER_TOKEN, { message: "註冊成功" }) };
      }),
      api.post("/api/user/check", () => ({
        json: { success: true, ...memberUser() },
      })),
    );
    renderRoutes(routes, { route: "/signup" });

    await fill({
      name: "  王小明 ",
      email: "traveler@example.com",
      password: "Travel2026",
    });
    await submit();

    expect(await screen.findByTestId("landing")).toHaveTextContent("首頁");
    expect(await findToast("註冊成功，歡迎 王小明")).toBeInTheDocument();
    // 確認密碼只在前端比對，不送給後端
    expect(body).toEqual({
      data: { name: "王小明", email: "traveler@example.com", password: "Travel2026" },
    });
    expect(document.cookie).toContain(`${COOKIE}=${MEMBER_TOKEN}`);
  });

  it("email 已註冊時顯示後端原因", async () => {
    server.use(
      api.post("/api/user/signup", () => failure(400, "此 Email 已註冊")),
    );
    renderRoutes(routes, { route: "/signup" });

    await fill({ name: "王小明", email: "traveler@example.com", password: "Travel2026" });
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("此 Email 已註冊");
    expect(document.cookie).not.toContain(`${COOKIE}=`);
  });

  it.each([
    ["太短", "Abc1234"],
    ["沒有數字", "abcdefgh"],
    ["沒有英文字母", "12345678"],
    ["含空白", "Travel 2026"],
  ])("密碼%s時顯示規則，不送出", async (_, password) => {
    // 沒有定義 /api/user/signup 的 handler，送出的話契約檢查會失敗
    renderRoutes(routes, { route: "/signup" });

    await fill({ name: "王小明", email: "traveler@example.com", password });
    await submit();

    expect(await screen.findByText(PASSWORD_RULE, { selector: ".text-alert" })).toBeInTheDocument();
  });

  it("兩次密碼不同、姓名過長或欄位空白時不送出", async () => {
    renderRoutes(routes, { route: "/signup" });

    await submit();
    expect(await screen.findByText("請輸入姓名")).toBeInTheDocument();
    expect(screen.getByText("請輸入 Email")).toBeInTheDocument();
    expect(screen.getByText("請輸入密碼")).toBeInTheDocument();
    expect(screen.getByText("請再輸入一次密碼")).toBeInTheDocument();

    await fill({ name: "名".repeat(31), password: "Travel2026", confirm: "Travel2027" });
    await submit();
    expect(await screen.findByText("姓名不得超過 30 個字")).toBeInTheDocument();
    expect(screen.getByText("兩次輸入的密碼不同")).toBeInTheDocument();
  });

  it("沒有錯誤時顯示密碼規則提示", () => {
    renderRoutes(routes, { route: "/signup" });

    expect(screen.getByLabelText("密碼")).toHaveAccessibleDescription(PASSWORD_RULE);
  });

  it("有登入連結", () => {
    renderRoutes(routes, { route: "/signup" });

    expect(screen.getByRole("link", { name: "會員登入" })).toHaveAttribute("href", "/signin");
  });
});
