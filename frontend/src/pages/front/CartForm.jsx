import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { currency } from "../../utils/filter";
import { updateOrderId, createAsyncSubmitForm } from "../../slice/orderSlice";
const CartForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLoading = useSelector((state) => state.order.isLoading);
  const orderId = useSelector((state) => state.order.orderId);
  const carts = useSelector((state) => state.cart.carts);
  const final_total = useSelector((state) => state.cart.final_total);
  const [origPrice, setOrigPrice] = useState(0);

  useEffect(() => {
    const total = carts.reduce((acc, cart) => {
      return acc + cart.product.origin_price * cart.qty;
    }, 0);

    setOrigPrice(total);
  }, [carts]);

  useEffect(() => {
    if (orderId !== "") {
      dispatch(updateOrderId(""));
      navigate(`/cartsuccess/${orderId}`);
    }
  }, [orderId]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    // reset,
  } = useForm({
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      tel: "",
      address: "",
      //for test
      // name: "percy",
      // email: "test123@gmail.com",
      // tel: "123456789",
      // address: "123",
    },
  });

  const onSubmit = async (data) => {
    const form = { data: { user: data, message: data.message } };
    dispatch(createAsyncSubmitForm(form));
  };

  return (
    <>
      <div className="margin-top cart-bg">
        <section className="cart-list">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="container">
              <div className="row py-10">
                <div className="col col-lg-8">
                  <div className="card bg-white rounded-4 border-0 mb-7">
                    <div className="d-flex flex-nowrap justify-content-start align-items-center py-5 px-7">
                      <button
                        className="btn btn-outline-primary rounded-3 py-5 px-9 delete-btn"
                        type="button"
                        onClick={() => navigate(`/cartcheckout`)}
                        disabled={isLoading}
                      >
                        返回購物車
                      </button>
                    </div>
                  </div>
                  <div className="card bg-white rounded-4 border-0 mb-7">
                    <div className="my-5 row justify-content-center">
                      <div
                        onSubmit={handleSubmit(onSubmit)}
                        className="col-md-10"
                      >
                        <div className="mb-3">
                          <label
                            htmlFor="name"
                            className="form-label text-neutral-100 fs-4"
                          >
                            收件人姓名
                          </label>
                          <input
                            id="name"
                            name="name"
                            type="text"
                            className="form-control text-primary-80"
                            placeholder="請輸入姓名"
                            {...register("name", {
                              required: "請輸入收件人姓名。",
                              minLength: {
                                value: 2,
                                message: "姓名最少兩個字",
                              },
                            })}
                          />
                          {errors.name && (
                            <p className="text-alert mt-3">
                              {errors.name.message}
                            </p>
                          )}
                        </div>

                        <div className="mb-3">
                          <label
                            htmlFor="email"
                            className="form-label text-neutral-100 fs-4"
                          >
                            Email
                          </label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            className="form-control text-primary-80"
                            placeholder="請輸入 Email"
                            {...register("email", {
                              required: "請輸入 Email。",
                              pattern: {
                                value:
                                  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                                message: "Email 格式不正確。",
                              },
                            })}
                          />
                          {errors.email && (
                            <p className="text-alert mt-3">
                              {errors.email.message}
                            </p>
                          )}
                        </div>

                        <div className="mb-3">
                          <label
                            htmlFor="tel"
                            className="form-label text-neutral-100 fs-4"
                          >
                            收件人電話
                          </label>
                          <input
                            id="tel"
                            name="tel"
                            type="tel"
                            className="form-control text-primary-80"
                            placeholder="請輸入電話"
                            {...register("tel", {
                              required: "請輸入收件人電話。",
                              minLength: {
                                value: 8,
                                message: "電話號碼至少需要 8 碼。",
                              },
                              pattern: {
                                value: /^\d+$/,
                                message: "電話號碼格式不正確，僅限數字。",
                              },
                            })}
                          />
                          {errors.tel && (
                            <p className="text-alert mt-3">
                              {errors.tel.message}
                            </p>
                          )}
                        </div>

                        <div className="mb-3">
                          <label
                            htmlFor="address"
                            className="form-label text-neutral-100 fs-4"
                          >
                            收件人地址
                          </label>
                          <input
                            id="address"
                            name="address"
                            type="text"
                            className="form-control text-primary-80"
                            placeholder="請輸入地址"
                            {...register("address", {
                              required: "請輸入收件人地址。",
                            })}
                          />
                          {errors.address && (
                            <p className="text-alert mt-3">
                              {errors.address.message}
                            </p>
                          )}
                        </div>

                        <div className="mb-3">
                          <label
                            htmlFor="message"
                            className="form-label text-neutral-100 fs-4"
                          >
                            留言
                          </label>
                          <textarea
                            id="message"
                            name="message"
                            className="form-control text-primary-80"
                            placeholder="留言"
                            rows="3"
                            {...register("message")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
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
                      type="submit"
                      disabled={
                        (carts?.length == 0 ? true : false) || isLoading
                      }
                    >
                      送出訂單
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
                        type="submit"
                        disabled={
                          (carts?.length == 0 ? true : false) || isLoading
                        }
                      >
                        送出訂單
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </>
  );
};

export default CartForm;
