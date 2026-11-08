import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dateInputToSeconds,
  discountLabel,
  isExpired,
  secondsToDateInput,
  summarizeCoupons,
} from "./coupon";
import { currency } from "./filter";
import { coupon, lineItem, product, tokyo } from "../test/fixtures";

describe("優惠券到期日換算（Unix 秒）", () => {
  it("日期轉成當天 23:59:59 的秒數", () => {
    const seconds = dateInputToSeconds("2030-01-15");
    const date = new Date(seconds * 1000);
    expect(Number.isInteger(seconds)).toBe(true);
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([
      23, 59, 59,
    ]);
  });

  it("秒數轉回同一天", () => {
    expect(secondsToDateInput(dateInputToSeconds("2030-01-05"))).toBe(
      "2030-01-05",
    );
  });

  it("沒有值時回空字串", () => {
    expect(secondsToDateInput(0)).toBe("");
    expect(secondsToDateInput(undefined)).toBe("");
  });
});

describe("discountLabel：實付比例轉折數", () => {
  it.each([
    [80, "8 折"],
    [85, "85 折"],
    ["90", "9 折"],
    [100, "不打折"],
    [0, "免費"],
    [101, ""],
    [-1, ""],
    [8.5, ""],
    ["abc", ""],
  ])("%s → %j", (percent, label) => {
    expect(discountLabel(percent)).toBe(label);
  });
});

describe("isExpired", () => {
  afterEach(() => vi.useRealTimers());

  it("以秒比較目前時間", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_800_000_000 * 1000));
    expect(isExpired(1_799_999_999)).toBe(true);
    expect(isExpired(1_800_000_001)).toBe(false);
  });
});

describe("summarizeCoupons", () => {
  it("加總售價小計與優惠券折抵，相同優惠券只列一次", () => {
    const c = coupon();
    const items = {
      a: lineItem(product(), 3, { id: "a", appliedCoupon: c }),
      b: lineItem(tokyo, 1, { id: "b", appliedCoupon: c }),
    };
    expect(summarizeCoupons(items)).toEqual({
      subtotal: 120000 + 25000,
      couponDiscount: 24000 + 5000,
      coupons: [c],
    });
  });

  it("套用後才加入的品項沒有 coupon，不影響計算", () => {
    const items = [
      lineItem(product(), 1, { appliedCoupon: coupon() }),
      lineItem(tokyo, 2),
    ];
    expect(summarizeCoupons(items)).toEqual({
      subtotal: 40000 + 50000,
      couponDiscount: 8000,
      coupons: [coupon()],
    });
  });

  it("沒有品項時都是 0", () => {
    expect(summarizeCoupons(undefined)).toEqual({
      subtotal: 0,
      couponDiscount: 0,
      coupons: [],
    });
  });
});

describe("currency", () => {
  it("加上千分位，非數字視為 0", () => {
    expect(currency(1234567)).toBe("1,234,567");
    expect(currency("96000")).toBe("96,000");
    expect(currency(undefined)).toBe("0");
  });
});
