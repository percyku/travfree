import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import * as bootstrap from "bootstrap";
import { currency } from "../../utils/filter";
import CartEmpty from "./CartEmpty";
import SingleProductModal from "./SingleProductModal";
import {
  createAsyncDeleteAllCart,
  createAsyncDeleteCart,
  createAsyncUpdateCart,
} from "../../slice/cartSlice";

// import { updateLoading } from "../../isLoadingSlice";
const CartCheckout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLoading = useSelector((state) => state.cart.isLoading);
  const carts = useSelector((state) => state.cart.carts);
  const final_total = useSelector((state) => state.cart.final_total);
  const [origPrice, setOrigPrice] = useState(0);

  const [product, setProduct] = useState({});
  const productModalRef = useRef(null);

  useEffect(() => {
    const total = carts.reduce((acc, cart) => {
      return acc + cart.product.origin_price * cart.qty;
    }, 0);

    setOrigPrice(total);

    productModalRef.current = new bootstrap.Modal("#productModal", {
      keyboard: false,
      // backdrop: "static",
    });
  }, [carts]);

  const deleteCartAll = () => {
    dispatch(createAsyncDeleteAllCart());
  };

  const updateCartQty = async (cartId, productId, qty) => {
    dispatch(createAsyncUpdateCart({ cartId, productId, qty }));
  };

  const deleteSingleCart = (e, id) => {
    e.preventDefault();
    dispatch(createAsyncDeleteCart(id));
  };

  const openModal = async (e, product) => {
    e.preventDefault();
    productModalRef.current.show();
    setProduct((prev) => {
      return { ...prev, ...product };
    });
  };
  const closeModal = () => {
    productModalRef.current.hide();
  };

  return (
    <>
      <div className="margin-top cart-bg ">
        <SingleProductModal product={product} closeModal={closeModal} />
        {carts?.length > 0 ? (
          <section className="cart-list">
            <div className="container">
              <div className="row py-10">
                <div className="col col-lg-8">
                  <div className="card bg-white rounded-4 border-0 mb-7">
                    <div className="d-flex flex-nowrap justify-content-end align-items-center py-5 px-7">
                      <button
                        className="btn btn-outline-primary rounded-3 py-5 px-9 delete-btn"
                        type="button"
                        onClick={deleteCartAll}
                        disabled={isLoading}
                      >
                        刪除選中活動
                      </button>
                    </div>
                  </div>

                  {carts?.map((cart) => {
                    return (
                      <div
                        className="card bg-white rounded-4 border-0 mb-5 mb-lg-7"
                        key={cart.product.id}
                      >
                        <div className="d-flex flex-column flex-lg-row align-items-lg-center px-5 pt-7 pb-5 ps-lg-7 pe-lg-9 py-lg-9 border-bottom">
                          <div className="cart-img-size mb-6 me-lg-4 d-none d-lg-block">
                            <img
                              src={cart.product.imageUrl}
                              className="object-fit-cover rounded-4 h-100"
                              alt="cart-1"
                            />
                          </div>

                          <div className="cart-img-size mb-6 me-lg-4 d-lg-none h-100 w-100">
                            <img
                              src={cart.product.imageUrl}
                              className="object-fit-cover rounded-4 "
                              alt={cart.product.title}
                            />
                          </div>
                          <div className="me-lg-7  w-100">
                            <h3 className="fs-4 fw-bold text-neutral-100 mb-2 text-center text-start">
                              {cart.product.title}
                            </h3>
                            <p className="fs-5 text-neutral-80 mb-2 text-start line-clamp-2">
                              <span className="fw-bold">商品描述：</span>
                              {cart.product.content}
                            </p>
                            <p className="fs-5 text-neutral-80 mb-7  text-start line-clamp-2">
                              <span className="fw-bold">商品內容：</span>
                              {cart.product.description}
                            </p>
                          </div>

                          <div className="d-flex flex-nowrap align-items-center me-lg-0 mx-auto">
                            <button
                              type="button"
                              className="p-5 rounded-circle btn border"
                              disabled={
                                (cart.qty == 1 ? true : false) || isLoading
                              }
                              onClick={() =>
                                updateCartQty(
                                  cart.id,
                                  cart.product_id,
                                  Number(cart.qty) - 1,
                                )
                              }
                            >
                              <span className="material-icons-outlined">
                                remove
                              </span>
                            </button>
                            <p className="fs-5 fw-bold text-neutral-100 mx-5 px-5 py-2">
                              {cart.qty}
                            </p>
                            <button
                              type="button"
                              className="p-5 rounded-circle btn border"
                              onClick={() =>
                                updateCartQty(
                                  cart.id,
                                  cart.product_id,
                                  Number(cart.qty) + 1,
                                )
                              }
                              disabled={isLoading}
                            >
                              <span className="material-icons-outlined">
                                add
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="d-flex flex-nowrap py-7 px-5 justify-content-between align-items-center ">
                          <div className="text-neutral-80">
                            <button
                              href="#"
                              className="btn border-0"
                              onClick={(e) => openModal(e, cart.product)}
                              disabled={isLoading}
                            >
                              <u>內容</u>
                            </button>
                            <button
                              href="#"
                              className="btn border-0"
                              onClick={(e) => deleteSingleCart(e, cart.id)}
                              disabled={isLoading}
                            >
                              <u>刪除</u>
                            </button>
                          </div>
                          <div>
                            <p className="fs-6  text-neutral-200">
                              原價 <del>NT$ {cart.product.origin_price}</del>
                            </p>
                            <p className="fs-5 fw-bold text-neutral-100">
                              優惠 NT$ {cart.product.price}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="col col-lg-4 d-none d-lg-block">
                  <div className="card bg-white rounded-4 p-7 border-0">
                    <h3 className="fs-4 fw-bold text-neutral-100">費用明細</h3>
                    <div className="border-bottom py-9 mb-9">
                      <div className="d-flex flex-nowrap justify-content-between z text-neutral-80 mb-4">
                        <p className="fs-5">原價小計</p>
                        <p className="fs-5 fw-bold">
                          NT$ {currency(origPrice)}
                        </p>
                      </div>

                      <div className="d-flex flex-nowrap justify-content-between text-neutral-80">
                        <p className="fs-5">優惠折抵</p>
                        <p className="fs-5 fw-bold text-primary-60">
                          - {origPrice - final_total}
                        </p>
                      </div>
                    </div>

                    <div className="d-flex flex-nowrap justify-content-between align-items-center text-neutral-80 mb-9">
                      <p className="fs-5">總計</p>
                      <p className="fs-3 fw-bold">
                        NT$ {currency(final_total)}
                      </p>
                    </div>

                    <button
                      className="btn btn-primary rounded-3 py-5 px-9 border-0"
                      type="button"
                      disabled={isLoading}
                      onClick={() => navigate(`/cartform`)}
                    >
                      前往結賬
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="d-lg-none bg-white">
              <div className="col-12">
                <div className="container rounded-4 border-0">
                  <div className="d-flex flex-nowrap justify-content-between align-items-center py-2">
                    <div
                      className="accordion accordion-flush border-0"
                      id="accordionExample"
                    >
                      <div className="accordion-item">
                        <h2 className="accordion-header" id="flush-headingOne">
                          <button
                            className="accordion-button text-neutral-80 fs-6"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#flush-collapseOne"
                            aria-expanded="false"
                            aria-controls="flush-collapseOne"
                          >
                            展開明細
                          </button>
                        </h2>
                        <div
                          id="flush-collapseOne"
                          className="accordion-collapse collapse"
                          aria-labelledby="flush-headingOne"
                          data-bs-parent="#accordionFlushExample"
                        >
                          <div className="accordion-body py-0">
                            <h3 className="text-neutral-100 fs-4">
                              NT$ {final_total}
                            </h3>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        className="btn btn-primary rounded-3 py-5 px-9 border-0"
                        type="button"
                        disabled={isLoading}
                        onClick={() => navigate(`/cartform`)}
                      >
                        前往結賬
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <CartEmpty />
        )}
      </div>
    </>
  );
};

export default CartCheckout;
