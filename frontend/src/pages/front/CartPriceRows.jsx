import { useSelector } from "react-redux";
import { currency } from "../../utils/filter";

/**
 * 費用明細中間的金額列，購物車頁與填寫資料頁共用。
 * 商品特價與優惠券是兩種折扣，分開列出：
 * - 原價小計：origin_price × qty
 * - 商品特價折抵：原價小計 − total（total 是售價小計）
 * - 優惠券折抵：total − final_total
 */
const CartPriceRows = () => {
  const carts = useSelector((state) => state.cart.carts);
  const total = useSelector((state) => state.cart.total);
  const finalTotal = useSelector((state) => state.cart.final_total);

  const origPrice = carts.reduce((acc, cart) => {
    return acc + cart.product.origin_price * cart.qty;
  }, 0);
  const couponCode = carts.find((cart) => cart.coupon)?.coupon.code;
  const productDiscount = origPrice - total;
  const couponDiscount = total - finalTotal;

  return (
    <div className="border-bottom py-9 mb-9">
      <div className="d-flex flex-nowrap justify-content-between text-neutral-80 mb-4">
        <p className="fs-5">原價小計</p>
        <p className="fs-5 fw-bold">NT$ {currency(origPrice)}</p>
      </div>

      <div className="d-flex flex-nowrap justify-content-between text-neutral-80 mb-4">
        <p className="fs-5">商品特價折抵</p>
        <p className="fs-5 fw-bold text-primary-60">
          - NT$ {currency(productDiscount)}
        </p>
      </div>

      <div className="d-flex flex-nowrap justify-content-between text-neutral-80">
        <p className="fs-5">
          優惠券折抵
          {couponCode && (
            <span className="badge bg-primary ms-2 fs-6">{couponCode}</span>
          )}
        </p>
        <p className="fs-5 fw-bold text-primary-60">
          - NT$ {currency(couponDiscount)}
        </p>
      </div>
    </div>
  );
};

export default CartPriceRows;
