// 優惠券的日期與折扣換算。due_date 是 Unix「秒」，percent 是「實付比例」（80 = 付 80%）。

const pad = (n) => String(n).padStart(2, "0");

/** Unix 秒 → <input type="date"> 的值（本地時間 YYYY-MM-DD） */
export const secondsToDateInput = (seconds) => {
  if (!seconds) return "";
  const d = new Date(seconds * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** <input type="date"> 的值 → 當天 23:59:59（本地時間）的 Unix 秒，優惠券有效到當天結束 */
export const dateInputToSeconds = (value) => {
  const [y, m, d] = value.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000);
};

/** 實付比例 → 台灣習慣的折數說明，例如 80 → 8 折、85 → 85 折 */
export const discountLabel = (percent) => {
  const p = Number(percent);
  if (!Number.isInteger(p) || p < 0 || p > 100) return "";
  if (p === 100) return "不打折";
  if (p === 0) return "免費";
  return p % 10 === 0 ? `${p / 10} 折` : `${p} 折`;
};

export const isExpired = (seconds) => seconds * 1000 < Date.now();

/**
 * 從訂單（或購物車）品項的優惠券快照整理出優惠資訊。
 * 品項的 coupon 只在有套用時出現；套用後才加入的品項沒有 coupon，所以不能假設每個品項都有。
 * @returns {{ subtotal: number, couponDiscount: number, coupons: object[] }}
 *   subtotal 是售價小計（各品項 total 相加），couponDiscount 是優惠券折抵金額
 */
export const summarizeCoupons = (items) => {
  const list = Object.values(items || {});
  const subtotal = list.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = list.reduce((sum, item) => sum + item.final_total, 0);
  const byId = new Map(
    list
      .filter((item) => item.coupon)
      .map((item) => [item.coupon.id, item.coupon]),
  );
  return {
    subtotal,
    couponDiscount: subtotal - finalTotal,
    coupons: [...byId.values()],
  };
};
