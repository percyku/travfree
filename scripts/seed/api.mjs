// seed.mjs、seed-demo.mjs 與 seed-export.mjs 共用：連線設定、登入與讀取全部資料。只用 Node 內建功能。

export const API_BASE = (process.env.API_BASE ?? "http://localhost:8000/v2").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Test123456";

let token;

/**
 * 呼叫 API，失敗時丟出含後端訊息的錯誤。
 * 預設帶 admin 的 token（signin() 之後）；as.token 可以改用其他帳號的 token。
 */
export const request = async (method, path, body, as = {}) => {
  const authorization = as.token ?? token;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authorization && { Authorization: authorization }),
      },
      body: body && JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`連不上 ${API_BASE}（${error.cause?.code ?? error.message}），後端是否已啟動？`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${path} 失敗（${res.status}）：${json.message ?? "沒有訊息"}`);
  }
  return json;
};

export const signin = async () => {
  try {
    const res = await request("POST", "/admin/signin", {
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    token = res.token;
  } catch (error) {
    throw new Error(`${error.message}\n以 ${ADMIN_EMAIL} 登入失敗，部署設定請帶上 ADMIN_PASSWORD=...`);
  }
};

/** 依序讀取分頁清單的每一頁 */
export const allPages = async (path, key) => {
  const items = [];
  for (let page = 1; ; page++) {
    const res = await request("GET", `${path}?page=${page}`);
    items.push(...res[key]);
    if (!res.pagination.has_next) return items;
  }
};

/** 後台的全部產品、文章與優惠券（含未上架、未公開、停用） */
export const fetchAll = async () => {
  const { products } = await request("GET", "/api/admin/products/all");
  return {
    products: Object.values(products), // 舊到新
    articles: await allPages("/api/admin/articles", "articles"), // 新到舊
    coupons: await allPages("/api/admin/coupons", "coupons"), // 新到舊
  };
};
