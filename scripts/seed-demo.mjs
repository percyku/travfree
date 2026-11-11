// 建立展示用的一般會員與他的兩筆訂單，用來在前台以會員登入、在後台看到會員下的訂單。
// 全部透過 API（註冊 → 加入購物車 → 結帳 → 付款），訂單與真實使用者下的一樣會對應到帳號。
// 需要先 npm run seed（用到「台北3日遊」「東京5日遊」與優惠碼 Test50）。
//
//   npm run seed:demo                                     # Docker（http://localhost:8000/v2）
//   API_BASE=http://localhost:8080/v2 npm run seed:demo   # 開發模式
//   DEMO_EMAIL=... DEMO_PASSWORD=... npm run seed:demo    # 改用其他帳號
//
// 帳號的密碼是公開的，所以只允許對本機執行。已經有展示訂單時不會重複下單。
import { API_BASE, allPages, request, signin } from "./seed/api.mjs";

const DEMO = {
  email: process.env.DEMO_EMAIL ?? "demo@example.com",
  password: process.env.DEMO_PASSWORD ?? "Demo2026",
  name: "示範會員",
};

const RECIPIENT = {
  name: DEMO.name,
  email: DEMO.email,
  tel: "0912345678",
  address: "台北市信義區市府路1號",
};

const ORDERS = [
  { items: [["台北3日遊", 1]], coupon: "Test50", paid: true, message: "示範訂單：套用 Test50，已付款" },
  { items: [["東京5日遊", 2]], paid: false, message: "示範訂單：未付款" },
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** 註冊展示會員；已經註冊過就登入。回傳 token */
const memberToken = async () => {
  try {
    return (await request("POST", "/api/user/signup", { data: DEMO })).token;
  } catch (error) {
    if (!error.message.includes("此 Email 已註冊")) throw error;
  }
  try {
    const res = await request("POST", "/api/user/signin", {
      username: DEMO.email,
      password: DEMO.password,
    });
    return res.token;
  } catch (error) {
    throw new Error(`${error.message}\n${DEMO.email} 已存在但密碼不同，請帶上 DEMO_PASSWORD=...`);
  }
};

/**
 * 建立任何資料之前，先確認需要的行程與優惠碼都可以用，避免做到一半失敗（帳號建了、訂單沒建）。
 * 回傳行程標題 → 產品
 */
const checkPrerequisites = async () => {
  const { products } = await request("GET", "/api/products/all");
  const byTitle = new Map(products.map((product) => [product.title, product]));
  const problems = [];
  for (const [title] of ORDERS.flatMap((order) => order.items)) {
    if (!byTitle.has(title)) problems.push(`找不到上架的行程「${title}」`);
  }
  const coupons = await allPages("/api/admin/coupons", "coupons");
  const now = Math.floor(Date.now() / 1000);
  for (const code of ORDERS.map((order) => order.coupon).filter(Boolean)) {
    const coupon = coupons.find((c) => c.code === code);
    if (!coupon) {
      problems.push(`找不到優惠碼 ${code}`);
    } else if (coupon.is_enabled !== 1) {
      problems.push(`優惠碼 ${code} 已停用`);
    } else if (coupon.due_date < now) {
      const due = new Date(coupon.due_date * 1000).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
      problems.push(`優惠碼 ${code} 已在 ${due} 過期`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `${problems.join("、")}，沒有建立任何資料。\n` +
        "先執行 npm run seed；資料已存在時 seed 不會更新，請到後台修正（例如把優惠券的到期日改到未來）。",
    );
  }
  return byTitle;
};

const placeOrder = async (as, products, { items, coupon, paid, message }) => {
  // 只結帳這筆訂單的品項：展示會員的購物車裡可能有之前放的東西
  await request("DELETE", "/api/carts", undefined, as);
  for (const [title, qty] of items) {
    const product = products.get(title);
    await request("POST", "/api/cart", { data: { product_id: product.id, qty } }, as);
  }
  if (coupon) await request("POST", "/api/coupon", { data: { code: coupon } }, as);
  const { orderId } = await request("POST", "/api/order", { data: { user: RECIPIENT, message } }, as);
  if (paid) await request("POST", `/api/pay/${orderId}`, undefined, as);
};

try {
  if (!LOCAL_HOSTS.has(new URL(API_BASE).hostname)) {
    throw new Error(`只能對本機執行（目前是 ${API_BASE}）：展示帳號的密碼是公開的，不要建立在部署環境`);
  }
  // 以 admin 查詢是否已經下過展示訂單（訂單的收件 email 是展示帳號）
  await signin();
  const existing = (await allPages("/api/admin/orders", "orders")).filter(
    (order) => order.user.email === DEMO.email,
  ).length;

  const byTitle = existing === 0 ? await checkPrerequisites() : null;
  const token = await memberToken();
  let created = 0;
  if (existing === 0) {
    for (const order of ORDERS) {
      await placeOrder({ token }, byTitle, order);
      created++;
    }
  }
  console.log(
    `展示會員 ${DEMO.email} / ${DEMO.password}（前台 /#/signin 登入）：新增訂單 ${created}（略過 ${existing}）`,
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
