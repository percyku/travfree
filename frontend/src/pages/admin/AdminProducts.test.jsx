import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProducts from "./AdminProducts";
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
import { pagination, product, tokyo } from "../../test/fixtures";

const taipei = product({
  imagesUrl: ["https://images.unsplash.com/photo-1519126400611-d57095205936"],
});
const hidden = { ...tokyo, is_enabled: 0 };
const UPLOADED = "http://localhost:8080/v2/uploads/0b6a4f1e-3c9d-4f0e-9b1a-2f7c8d9e0a1b.png";

/** 模擬後台產品 API，記錄前端送出的請求 */
const useProductBackend = (options = {}) => {
  const requests = [];
  server.use(
    api.get("/api/admin/products", ({ request }) => {
      const page = new URL(request.url).searchParams.get("page");
      requests.push(["GET", page]);
      return {
        json: {
          success: true,
          products: [taipei, hidden],
          pagination: pagination({ total_pages: 2, current_page: Number(page) }),
          messages: [],
        },
      };
    }),
    api.post("/api/admin/product", ({ body }) => {
      requests.push(["POST", body]);
      return options.createError
        ? failure(400, options.createError)
        : { json: { success: true, message: "已建立產品" } };
    }),
    api.put("/api/admin/product/{id}", ({ params, body }) => {
      requests.push([`PUT ${params.id}`, body]);
      return { json: { success: true, message: "已更新產品" } };
    }),
    api.delete("/api/admin/product/{id}", ({ params }) => {
      requests.push([`DELETE ${params.id}`]);
      return { json: { success: true, message: "已刪除產品" } };
    }),
    api.post("/api/admin/upload", ({ body }) => {
      requests.push(["UPLOAD", body.get("file-to-upload")?.name]);
      return options.uploadError
        ? failure(400, options.uploadError)
        : { json: { success: true, imageUrl: UPLOADED } };
    }),
  );
  return requests;
};

const renderPage = () =>
  renderRoutes(
    [
      { path: "/admin/products", element: <AdminProducts /> },
      { path: "/login", element: <Landing name="登入頁" /> },
    ],
    { route: "/admin/products" },
  );

const rowOf = async (text) => (await screen.findByText(text)).closest("tr");

const openCreate = async () => {
  await rowOf(taipei.title);
  await userEvent.click(screen.getByRole("button", { name: "建立新的產品" }));
  return within(await findDialog());
};

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "photo.png", {
    type: "image/png",
  });

describe("後台產品", () => {
  beforeEach(signInAsAdmin);

  it("列出產品的價格與上架狀態", async () => {
    useProductBackend();
    renderPage();

    const row = within(await rowOf(taipei.title));
    expect(row.getByText("亞洲")).toBeInTheDocument();
    expect(row.getByText("50000")).toBeInTheDocument();
    expect(row.getByText("40000")).toBeInTheDocument();
    expect(row.getByText("啟用")).toBeInTheDocument();
    expect(within(await rowOf(tokyo.title)).getByText("未啟用")).toBeInTheDocument();
  });

  it("新增產品：價格轉成整數、上架轉成 1，空白的副圖不送出", async () => {
    const requests = useProductBackend();
    renderPage();
    const dialog = await openCreate();
    expect(dialog.getByText("新增產品")).toBeInTheDocument();

    await userEvent.type(dialog.getByLabelText("標題"), "京都4日遊");
    await userEvent.type(dialog.getByLabelText("分類"), "亞洲");
    await userEvent.type(dialog.getByLabelText("單位"), "台幣");
    await userEvent.type(dialog.getByLabelText("原價"), "36000");
    await userEvent.type(dialog.getByLabelText("售價"), "32000");
    await userEvent.type(dialog.getByLabelText("產品描述"), "清水寺與嵐山");
    await userEvent.type(dialog.getByLabelText("說明內容"), "四天三夜");
    await userEvent.click(dialog.getByLabelText("是否啟用"));
    await userEvent.clear(dialog.getByLabelText("輸入圖片網址"));
    await userEvent.type(dialog.getByLabelText("輸入圖片網址"), "https://example.com/main.jpg");
    await userEvent.click(dialog.getByRole("button", { name: "新增圖片" }));
    await userEvent.type(dialog.getByPlaceholderText("圖片網址 1"), "https://example.com/1.jpg");
    await userEvent.click(dialog.getByRole("button", { name: "新增圖片" }));
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("已建立產品")).toBeInTheDocument();
    const [, body] = requests.find(([method]) => method === "POST");
    expect(body.data).toMatchObject({
      title: "京都4日遊",
      category: "亞洲",
      unit: "台幣",
      origin_price: 36000,
      price: 32000,
      description: "清水寺與嵐山",
      content: "四天三夜",
      is_enabled: 1,
      imageUrl: "https://example.com/main.jpg",
      imagesUrl: ["https://example.com/1.jpg"],
    });
    await waitForDialogClosed();
    expect(requests.filter(([method]) => method === "GET")).toHaveLength(2);
  });

  it("新增失敗時顯示後端原因", async () => {
    useProductBackend({ createError: "title 屬性不得為空" });
    renderPage();
    const dialog = await openCreate();

    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("新增失敗! title 屬性不得為空")).toBeInTheDocument();
    await closeDialog(userEvent);
  });

  it("編輯產品：帶入原本的值，送出整筆資料", async () => {
    const requests = useProductBackend();
    renderPage();

    const row = within(await rowOf(taipei.title));
    await userEvent.click(row.getByRole("button", { name: "編輯" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("更新產品")).toBeInTheDocument();
    expect(dialog.getByLabelText("標題")).toHaveValue(taipei.title);
    expect(dialog.getByLabelText("售價")).toHaveValue(40000);
    expect(dialog.getByLabelText("是否啟用")).toBeChecked();
    expect(dialog.getByPlaceholderText("圖片網址 1")).toHaveValue(taipei.imagesUrl[0]);

    await userEvent.clear(dialog.getByLabelText("售價"));
    await userEvent.type(dialog.getByLabelText("售價"), "38000");
    await userEvent.click(dialog.getByRole("button", { name: "送出" }));

    expect(await findToast("已更新產品")).toBeInTheDocument();
    const [, body] = requests.find(([method]) => method === `PUT ${taipei.id}`);
    expect(body.data).toMatchObject({
      title: taipei.title,
      origin_price: 50000,
      price: 38000,
      is_enabled: 1,
      imageUrl: taipei.imageUrl,
      imagesUrl: taipei.imagesUrl,
    });
    await waitForDialogClosed();
  });

  it("刪除前說明影響，並建議改為下架", async () => {
    const requests = useProductBackend();
    renderPage();

    const row = within(await rowOf(tokyo.title));
    await userEvent.click(row.getByRole("button", { name: "刪除" }));
    const dialog = within(await findDialog());
    expect(dialog.getByText("刪除產品")).toBeInTheDocument();
    expect(dialog.getByText(/購物車中的這項商品會一併移除/)).toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "刪除" }));

    expect(await findToast("已刪除產品")).toBeInTheDocument();
    expect(requests).toContainEqual([`DELETE ${tokyo.id}`]);
    await waitForDialogClosed();
  });

  it("上傳圖片後把網址填入主圖", async () => {
    const requests = useProductBackend();
    renderPage();
    const dialog = await openCreate();

    await userEvent.upload(dialog.getByLabelText("圖片上傳"), png());

    expect(await findToast("上傳成功")).toBeInTheDocument();
    expect(requests).toContainEqual(["UPLOAD", "photo.png"]);
    expect(dialog.getByLabelText("輸入圖片網址")).toHaveValue(UPLOADED);
    await closeDialog(userEvent);
  });

  it("上傳失敗時顯示後端原因", async () => {
    useProductBackend({ uploadError: "檔案大小不得超過 3MB" });
    renderPage();
    const dialog = await openCreate();

    await userEvent.upload(dialog.getByLabelText("圖片上傳"), png());

    expect(await findToast("上傳失敗! 檔案大小不得超過 3MB")).toBeInTheDocument();
    await closeDialog(userEvent);
  });

  it("切換分頁時帶上頁碼", async () => {
    const requests = useProductBackend();
    renderPage();
    await rowOf(taipei.title);

    await userEvent.click(screen.getByRole("link", { name: "2" }));

    await waitFor(() => expect(requests).toContainEqual(["GET", "2"]));
  });

  it("取得資料失敗時導向登入頁", async () => {
    server.use(
      api.get("/api/admin/products", () => failure(401, "驗證錯誤, 請重新登入")),
    );
    renderPage();

    expect(await findToast("取得資料失敗，請重新登入")).toBeInTheDocument();
    expect(await screen.findByTestId("landing")).toHaveTextContent("登入頁");
  });
});
