import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminArticle from "./AdminArticle";
import { api, failure } from "../../test/contract";
import { server } from "../../test/server";
import {
  closeDialog,
  findDialog,
  findToast,
  Landing,
  renderRoutes,
  signInAsAdmin,
  waitForDialogClosed,
} from "../../test/render";
import { article, pagination } from "../../test/fixtures";

const london = article();
const tokyoDraft = article({
  id: "5f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
  title: "東京美食地圖",
  image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf",
  tag: ["亞洲"],
  create_at: 1775000000000,
  author: "Mia",
  isPublic: false,
  content: "築地市場、月島文字燒。",
});

/** 模擬後台文章 API，記錄前端送出的請求 */
const useArticleBackend = (options = {}) => {
  const requests = [];
  server.use(
    api.get("/api/admin/articles", ({ request }) => {
      const page = new URL(request.url).searchParams.get("page");
      requests.push(["GET", page]);
      return {
        json: {
          success: true,
          articles: [london, tokyoDraft],
          pagination: pagination({ total_pages: 2 }),
          messages: [],
        },
      };
    }),
    api.post("/api/admin/article", ({ body }) => {
      requests.push(["POST", body]);
      return options.createError
        ? failure(400, options.createError)
        : { json: { success: true, message: "已建立文章" } };
    }),
    api.put("/api/admin/article/{id}", ({ params, body }) => {
      requests.push([`PUT ${params.id}`, body]);
      return { json: { success: true, message: "已更新文章" } };
    }),
    api.delete("/api/admin/article/{id}", ({ params }) => {
      requests.push([`DELETE ${params.id}`]);
      return { json: { success: true, message: "已刪除文章" } };
    }),
  );
  return requests;
};

const renderPage = () =>
  renderRoutes(
    [
      { path: "/admin/articles", element: <AdminArticle /> },
      { path: "/login", element: <Landing name="登入頁" /> },
    ],
    { route: "/admin/articles" },
  );

const rowOf = async (text) => (await screen.findByText(text)).closest("tr");

const openEdit = async (title) => {
  const row = within(await rowOf(title));
  await userEvent.click(row.getByRole("button", { name: "編輯" }));
  return within(await findDialog());
};

describe("後台文章", () => {
  beforeEach(signInAsAdmin);
  afterEach(() => vi.useRealTimers());

  it("列出文章的作者、建立時間（毫秒）與公開狀態", async () => {
    useArticleBackend();
    renderPage();

    const row = within(await rowOf(london.title));
    expect(row.getByText("Oscar")).toBeInTheDocument();
    expect(
      row.getByText(new Date(london.create_at).toLocaleString()),
    ).toBeInTheDocument();
    expect(row.getByText("啟用")).toBeInTheDocument();
    expect(within(await rowOf(tokyoDraft.title)).getByText("未啟用")).toBeInTheDocument();
  });

  it("新增文章：帶上分類、內文，create_at 為目前的毫秒", async () => {
    const requests = useArticleBackend();
    renderPage();
    await rowOf(london.title);

    await userEvent.click(screen.getByRole("button", { name: "建立新的文章" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("新增文章")).toBeInTheDocument();

    await userEvent.type(dialog.getByLabelText("標題"), "巴黎散步");
    await userEvent.type(dialog.getByLabelText("作者"), "Léa");
    await userEvent.clear(dialog.getByLabelText("輸入圖片網址"));
    await userEvent.type(dialog.getByLabelText("輸入圖片網址"), "https://example.com/paris.jpg");
    await userEvent.type(dialog.getByLabelText(/摘要/), "塞納河畔");
    await userEvent.type(dialog.getByLabelText("內文"), "第一天{Enter}第二天");
    await userEvent.click(dialog.getByLabelText("歐洲"));
    await userEvent.click(dialog.getByLabelText("是否啟用"));

    const before = Date.now();
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("已建立文章")).toBeInTheDocument();
    const [, body] = requests.find(([method]) => method === "POST");
    expect(body.data).toMatchObject({
      title: "巴黎散步",
      author: "Léa",
      image: "https://example.com/paris.jpg",
      description: "塞納河畔",
      content: "第一天\n第二天",
      tag: ["歐洲"],
      isPublic: true,
    });
    expect(body.data.create_at).toBeGreaterThanOrEqual(before);
    expect(body.data.create_at).toBeLessThanOrEqual(Date.now());
    await waitForDialogClosed();
  });

  it("沒有選分類時提示，不送出", async () => {
    const requests = useArticleBackend();
    renderPage();
    await rowOf(london.title);

    await userEvent.click(screen.getByRole("button", { name: "建立新的文章" }));
    const dialog = within(await findDialog());
    await userEvent.type(dialog.getByLabelText("標題"), "巴黎散步");
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("請至少選擇一個分類")).toBeInTheDocument();
    expect(requests.some(([method]) => method === "POST")).toBe(false);
    await closeDialog(userEvent);
  });

  it("新增失敗時顯示後端原因", async () => {
    useArticleBackend({ createError: "content 屬性不得為空" });
    renderPage();
    await rowOf(london.title);

    await userEvent.click(screen.getByRole("button", { name: "建立新的文章" }));
    const dialog = within(await findDialog());
    await userEvent.click(dialog.getByLabelText("亞洲"));
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("新增失敗! content 屬性不得為空")).toBeInTheDocument();
    await closeDialog(userEvent);
  });

  it("編輯文章：帶入原本的內文與分類，create_at 保留原值", async () => {
    const requests = useArticleBackend();
    renderPage();

    const dialog = await openEdit(london.title);
    expect(dialog.getByText("更新文章")).toBeInTheDocument();
    expect(dialog.getByLabelText("標題")).toHaveValue(london.title);
    expect(dialog.getByLabelText("作者")).toHaveValue("Oscar");
    expect(dialog.getByLabelText("內文")).toHaveValue(london.content);
    expect(dialog.getByLabelText("歐洲")).toBeChecked();
    expect(dialog.getByLabelText("亞洲")).not.toBeChecked();

    await userEvent.click(dialog.getByLabelText("亞洲"));
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("已更新文章")).toBeInTheDocument();
    const [, body] = requests.find(([method]) => method === `PUT ${london.id}`);
    expect(body.data).toMatchObject({
      title: london.title,
      content: london.content,
      tag: ["歐洲", "亞洲"],
      create_at: london.create_at,
      image: london.image,
    });
    await waitForDialogClosed();
  });

  it("連續編輯兩篇文章時，圖片網址顯示各自的值", async () => {
    useArticleBackend();
    renderPage();

    let dialog = await openEdit(london.title);
    expect(dialog.getByLabelText("輸入圖片網址")).toHaveValue(london.image);
    await closeDialog(userEvent);

    dialog = await openEdit(tokyoDraft.title);
    expect(dialog.getByLabelText("輸入圖片網址")).toHaveValue(tokyoDraft.image);
    await closeDialog(userEvent);
  });

  it("刪除文章", async () => {
    const requests = useArticleBackend();
    renderPage();

    const row = within(await rowOf(tokyoDraft.title));
    await userEvent.click(row.getByRole("button", { name: "刪除" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("刪除文章")).toBeInTheDocument();
    expect(dialog.getByText(/確定要刪除/)).toHaveTextContent(tokyoDraft.title);

    await userEvent.click(dialog.getByRole("button", { name: "刪除" }));

    expect(await findToast("已刪除文章")).toBeInTheDocument();
    expect(requests).toContainEqual([`DELETE ${tokyoDraft.id}`]);
    await waitForDialogClosed();
  });

  it("切換分頁時帶上頁碼", async () => {
    const requests = useArticleBackend();
    renderPage();
    await rowOf(london.title);

    await userEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(requests).toContainEqual(["GET", "2"]));
  });

  it("取得資料失敗時導向登入頁", async () => {
    server.use(
      api.get("/api/admin/articles", () => failure(401, "驗證錯誤, 請重新登入")),
    );
    renderPage();

    expect(await findToast("取得資料失敗，請重新登入")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁");
  });
});
