// 訪客購物車的識別（X-Cart-Id）。每個瀏覽器產生一次，存在 localStorage。
// 登入後後端改用帳號的購物車並忽略它；登入時由 authSlice 呼叫 /api/cart/merge 把訪客購物車併過去。
const STORAGE_KEY = "freetrav-cart-id";

let memoryId;

/** crypto.randomUUID 只在安全來源（https 或 localhost）可用，其他情況以 getRandomValues 產生 v4 UUID */
const randomUuid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const getCartId = () => {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomUuid();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // 無痕模式或封鎖網站資料時 localStorage 會丟錯，退而存在記憶體（重新整理後是新的購物車）
    memoryId ??= randomUuid();
    return memoryId;
  }
};

/** 購物車與優惠券的請求都帶上 */
export const cartConfig = () => ({ headers: { "X-Cart-Id": getCartId() } });
