// 測試假資料，欄位比照 docs/openapi.yaml 的範例。回應經過 contract.js 時會再對 spec 驗證。

export const coupon = (overrides = {}) => ({
  id: "5a9d667c-ce0c-434b-836c-d2e6c591afbb",
  title: "測試八折",
  code: "TEST80",
  percent: 80,
  due_date: 1893456000,
  is_enabled: 1,
  ...overrides,
});

export const product = (overrides = {}) => ({
  id: "c0051992-48d9-4d8e-84f4-e0730626f0ab",
  title: "台北3日遊",
  category: "亞洲",
  unit: "台幣",
  origin_price: 50000,
  price: 40000,
  description: "搭乘捷運即可抵達 90% 的景點。",
  content: "融合殖民歷史、現代科技與溫暖人情味的城市。",
  is_enabled: 1,
  imageUrl: "https://images.unsplash.com/photo-1609147110688-83b5fd1288e8",
  imagesUrl: [],
  ...overrides,
});

export const tokyo = product({
  id: "8b2f5c1e-7a3d-4e9b-b1c2-0d4e5f6a7b8c",
  title: "東京5日遊",
  origin_price: 30000,
  price: 25000,
});

/** 購物車品項。傳入 percent 時視為已套用優惠券，final_total 依 spec 四捨五入 */
export const lineItem = (prod, qty, { id, appliedCoupon } = {}) => {
  const total = prod.price * qty;
  return {
    id: id ?? `item-${prod.id}`,
    product_id: prod.id,
    qty,
    total,
    final_total: appliedCoupon
      ? Math.round((total * appliedCoupon.percent) / 100)
      : total,
    ...(appliedCoupon && { coupon: appliedCoupon }),
    product: prod,
  };
};

/** GET /api/cart 的 data */
export const cart = (items) => ({
  carts: items,
  total: items.reduce((sum, item) => sum + item.total, 0),
  final_total: items.reduce((sum, item) => sum + item.final_total, 0),
});

export const cartResponse = (items) => ({
  json: { success: true, data: cart(items), messages: [] },
});

export const order = (overrides = {}) => {
  const item = lineItem(product(), 3, { appliedCoupon: coupon() });
  return {
    id: "51149043-3529-456d-93de-691e7cdf5d0d",
    create_at: 1793799389,
    is_paid: false,
    status: 0,
    total: item.final_total,
    user: {
      name: "王小明",
      email: "test@example.com",
      tel: "0912345678",
      address: "台北市信義區市府路1號",
    },
    products: { [item.id]: item },
    ...overrides,
  };
};

/** 登入取得的 token，比照 spec 範例 */
export const ADMIN_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkBnbWFpbC5jb20ifQ.c2lnbmF0dXJl";

export const MEMBER_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0cmF2ZWxlciJ9.bWVtYmVyc2lnbg";

/** POST /api/user/check 的回應中的帳號，預設的 admin 只有 ADMIN */
export const adminUser = (overrides = {}) => ({
  uid: "3f1c2a8e-5b7d-4e2f-9a61-0c8d4b2e7f90",
  email: "admin@gmail.com",
  name: "管理者",
  roles: ["ADMIN"],
  ...overrides,
});

export const memberUser = (overrides = {}) => ({
  uid: "7a2d9c41-0e6b-4f3a-8d15-b6c0e2f4a937",
  email: "traveler@example.com",
  name: "王小明",
  roles: ["USER"],
  ...overrides,
});

/** GET /api/user/profile 的會員資料；未填的電話與地址是空字串 */
export const memberProfile = (overrides = {}) => ({
  email: "traveler@example.com",
  name: "王小明",
  tel: "",
  address: "",
  ...overrides,
});

/** 登入與註冊成功的回應，expired 是毫秒 */
export const signinSuccess = (token, { uid, message = "登入成功" } = {}) => ({
  success: true,
  message,
  uid: uid ?? "3f1c2a8e-5b7d-4e2f-9a61-0c8d4b2e7f90",
  token,
  expired: Date.now() + 7 * 24 * 60 * 60 * 1000,
});

export const pagination = (overrides = {}) => ({
  total_pages: 1,
  current_page: 1,
  has_pre: false,
  has_next: false,
  category: "",
  ...overrides,
});

export const article = (overrides = {}) => ({
  id: "db06bc3c-dee9-4684-a26d-d79b37ce3de1",
  title: "大英帝國巡禮",
  description: "倫敦旅遊必去大英博物館、倫敦塔、白金漢宮。",
  image: "https://images.unsplash.com/photo-1533929736458-ca588d08c8be",
  tag: ["歐洲"],
  create_at: 1774092156547, // 毫秒，原值保存
  author: "Oscar",
  isPublic: true,
  content: "第一天從大英博物館開始，下午前往倫敦塔與塔橋。",
  ...overrides,
});
