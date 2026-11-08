import { render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { expect } from "vitest";
import { Provider } from "react-redux";
import { MemoryRouter, useRoutes, useParams } from "react-router-dom";
import { makeStore } from "../store/store";
import MessageToast from "../components/MessageToast";
import { ADMIN_TOKEN } from "./fixtures";

/** 模擬 ProductedRoute 驗證通過後的狀態：axios 帶上 admin token。setup.js 會在測試後清除 */
export const signInAsAdmin = () => {
  axios.defaults.headers.common.Authorization = ADMIN_TOKEN;
};

/** 導向後的頁面用這個代替，只顯示路徑，方便斷言 */
export const Landing = ({ name }) => {
  const params = useParams();
  return (
    <p data-testid="landing">
      {name}
      {Object.values(params).join("/")}
    </p>
  );
};

const AppRoutes = ({ routes }) => useRoutes(routes);

/**
 * 以獨立的 store 與 MemoryRouter 渲染頁面，並帶上 MessageToast 讓提示訊息可以被斷言。
 * 不用 createMemoryRouter：data router 在 jsdom 下建立 Request 會與 Node 的 AbortSignal 衝突，
 * 頁面也沒有用到 loader。
 * @param {object[]} routes React Router 的 routes
 * @param {object} [options]
 * @param {string} [options.route] 初始網址
 * @param {object} [options.preloadedState] Redux 初始狀態
 */
export const renderRoutes = (routes, { route = "/", preloadedState } = {}) => {
  const store = makeStore(preloadedState);
  const result = render(
    <Provider store={store}>
      <MessageToast />
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes routes={routes} />
      </MemoryRouter>
    </Provider>,
  );
  return { ...result, store };
};

/** 提示訊息（MessageToast） */
export const findToast = (text) =>
  screen.findByText(text, { selector: ".toast-body" });

/** 等 Bootstrap modal 開啟。開啟後才會移除 aria-hidden，可以用 role 查詢 */
export const findDialog = () => screen.findByRole("dialog");

/**
 * 等 Bootstrap modal 完全關閉（含 backdrop 動畫）。
 * 動畫進行中就卸載元件的話，Bootstrap 的 callback 會找不到元素而丟錯，
 * 所以開過 modal 的測試都要等它關閉再結束。
 */
export const waitForDialogClosed = () =>
  waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("modal-open");
  });

/** 按「取消」（或指定的按鈕）關閉 modal 並等它完全關閉 */
export const closeDialog = async (user, name = "取消") => {
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name }));
  await waitForDialogClosed();
};
