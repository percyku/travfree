import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createAsyncApplyCoupon,
  createAsyncRemoveCoupon,
} from "../../slice/cartSlice";

/** 購物車頁的優惠碼輸入。套用成功或失敗的提示由 thunk 顯示。 */
const CouponForm = () => {
  const dispatch = useDispatch();
  const isLoading = useSelector((state) => state.cart.isLoading);
  const carts = useSelector((state) => state.cart.carts);
  const [code, setCode] = useState("");

  const appliedCode = carts.find((cart) => cart.coupon)?.coupon.code;
  // 優惠券只套用在套用當下的品項，之後才加入的品項沒有 coupon
  const hasItemsWithoutCoupon =
    appliedCode && carts.some((cart) => !cart.coupon);

  const applyCoupon = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      await dispatch(createAsyncApplyCoupon(trimmed)).unwrap();
      setCode("");
    } catch {
      // 錯誤訊息已由 thunk 顯示，保留輸入內容方便修改
    }
  };

  const removeCoupon = () => {
    // 錯誤訊息已由 thunk 顯示
    dispatch(createAsyncRemoveCoupon()).catch(() => {});
  };

  return (
    <form className="mb-7" onSubmit={applyCoupon}>
      <label htmlFor="couponCode" className="form-label text-neutral-80">
        優惠碼
      </label>
      <div className="input-group">
        <input
          id="couponCode"
          type="text"
          className="form-control"
          placeholder="請輸入優惠碼"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className="btn btn-outline-primary"
          type="submit"
          disabled={isLoading || !code.trim()}
        >
          套用
        </button>
      </div>
      {appliedCode && (
        <p className="fs-6 text-neutral-80 mt-2 mb-0">
          已套用優惠碼 {appliedCode}
          {hasItemsWithoutCoupon && "，之後加入的商品需要重新套用"}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 ms-2 align-baseline"
            disabled={isLoading}
            onClick={removeCoupon}
          >
            移除
          </button>
        </p>
      )}
    </form>
  );
};

export default CouponForm;
