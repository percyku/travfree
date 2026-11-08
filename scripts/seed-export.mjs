// 從執行中的後端匯出產品、文章與優惠券到 scripts/seed/data.json，作為新的種子資料。
// 不含 id 與 num（匯入時由後端產生）。訂單與帳號不匯出。
//
//   npm run seed:export                                     # Docker
//   API_BASE=http://localhost:8080/v2 npm run seed:export   # 開發模式
import { writeFileSync } from "node:fs";
import { API_BASE, fetchAll, signin } from "./seed/api.mjs";

const omit = (item, keys) =>
  Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)));

try {
  await signin();
  const { products, articles, coupons } = await fetchAll();
  const data = {
    // 依建立順序匯入，後台清單的排序才會與原本相同
    products: products.map((p) => omit(p, ["id", "num"])),
    articles: articles.reverse().map((a) => omit(a, ["id", "num"])),
    coupons: coupons.reverse().map((c) => omit(c, ["id", "num"])),
  };
  const file = new URL("./seed/data.json", import.meta.url);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `已從 ${API_BASE} 匯出：產品 ${data.products.length}、文章 ${data.articles.length}、優惠券 ${data.coupons.length}`,
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
