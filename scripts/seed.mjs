// 把 scripts/seed/data.json 的產品、文章與優惠券透過 API 匯入。
// 已存在的資料（產品與文章依標題、優惠券依優惠碼）會略過，重複執行不會重複新增。
//
//   npm run seed                                     # Docker（http://localhost:8000/v2）
//   API_BASE=http://localhost:8080/v2 npm run seed   # 開發模式
//   ADMIN_PASSWORD=... npm run seed                  # 部署設定的 admin 密碼
import { readFileSync } from "node:fs";
import { API_BASE, fetchAll, request, signin } from "./seed/api.mjs";

const data = JSON.parse(
  readFileSync(new URL("./seed/data.json", import.meta.url), "utf8"),
);

const seed = async (label, items, existingKeys, keyOf, path) => {
  let created = 0;
  for (const item of items) {
    if (existingKeys.has(keyOf(item))) continue;
    await request("POST", path, { data: item });
    existingKeys.add(keyOf(item));
    created++;
  }
  const skipped = items.length - created;
  return `${label} ${created}（略過 ${skipped}）`;
};

try {
  await signin();
  const existing = await fetchAll();
  const results = [
    await seed(
      "產品",
      data.products,
      new Set(existing.products.map((p) => p.title)),
      (p) => p.title,
      "/api/admin/product",
    ),
    await seed(
      "文章",
      data.articles,
      new Set(existing.articles.map((a) => a.title)),
      (a) => a.title,
      "/api/admin/article",
    ),
    await seed(
      "優惠券",
      data.coupons,
      new Set(existing.coupons.map((c) => c.code)),
      (c) => c.code,
      "/api/admin/coupon",
    ),
  ];
  console.log(`已匯入 ${API_BASE}：新增 ${results.join("、")}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
