// import empty from "../assets/images/empty.svg";
import empty from "../../assets/images/empty.svg";
import { useNavigate } from "react-router-dom";
const CartEmpty = () => {
  const navigate = useNavigate();

  return (
    <>
      <section className="cart-empty">
        <div className="container py-11">
          <div className="d-flex flex-column justify-content-center align-items-center">
            <img src={empty} className="cart-empty-img-size mb-7" alt="empty" />
            <div>
              <p className="text-neutral-80">購物車還沒有商品，立即逛逛！</p>

              <button
                className="btn btn-primary rounded-3 py-5 px-9 border-0 w-100"
                type="button"
                onClick={() => navigate(`/product`)}
              >
                前往旅程
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default CartEmpty;
