import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { currency } from "../../utils/filter";
import CartPriceRows from "./CartPriceRows";
import { updateOrderId, createAsyncSubmitForm } from "../../slice/orderSlice";
import { createAsyncGetCart } from "../../slice/cartSlice";
import { createAsyncMessage } from "../../slice/messageSlice";
import { fetchProfile, signoutHandled } from "../../slice/authSlice";

/** 結帳需要 USER 角色（見 spec 的 POST /api/order）；只有 ADMIN 的帳號（例如預設 admin）不能結帳 */
const canCheckout = (user) => user?.roles?.includes("USER") ?? false;

const CartForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLoading = useSelector((state) => state.order.isLoading);
  const orderId = useSelector((state) => state.order.orderId);
  const carts = useSelector((state) => state.cart.carts);
  const final_total = useSelector((state) => state.cart.final_total);
  const user = useSelector((state) => state.auth.user);
  const authChecked = useSelector((state) => state.auth.checked);
  const signedOutHere = useSelector(
    (state) => state.auth.signedOutFrom === "/cartform",
  );

  // 進入頁面時重新讀取購物車，顯示最新金額（優惠券可能已被停用、刪除，或商品改價）
  useEffect(() => {
    dispatch(createAsyncGetCart());
  }, [dispatch]);

  useEffect(() => {
    if (orderId !== "") {
      dispatch(updateOrderId(""));
      navigate(`/cartsuccess/${orderId}`);
    }
  }, [orderId, dispatch, navigate]);

  // Header 確認登入狀態後才判斷，否則重新整理本頁時會在確認前被導向登入頁。
  // 在本頁按 Header 的登出時回首頁，不導向登入頁
  useEffect(() => {
    if (!authChecked || user) return;
    if (signedOutHere) {
      navigate("/", { replace: true });
      return;
    }
    dispatch(
      createAsyncMessage({ success: false, message: "請先登入會員再結帳" }),
    );
    navigate("/signin", { replace: true, state: { from: "/cartform" } });
  }, [authChecked, user, signedOutHere, dispatch, navigate]);

  // 離開本頁後才清除登出標記。不能在導向時清除：導向是 transition，完成前本頁會再渲染一次，
  // 那時標記已清掉、user 是 null，就會被當成未登入導向登入頁
  useEffect(() => () => dispatch(signoutHandled()), [dispatch]);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
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

  // 以帳號的姓名、email 與會員中心的電話、地址預先填入收件資料，已經輸入的不覆蓋；收件資料可以與帳號不同
  const fill = useCallback(
    (field, value) => {
      if (value && getValues(field) === "") setValue(field, value);
    },
    [getValues, setValue],
  );

  useEffect(() => {
    if (!user) return;
    fill("name", user.name);
    fill("email", user.email);
  }, [user, fill]);

  // 會員資料讀不到時（例如網路錯誤）只帶入姓名與 email，不影響結帳
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    dispatch(fetchProfile())
      .unwrap()
      .then((profile) => {
        if (!active) return;
        fill("tel", profile.tel);
        fill("address", profile.address);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uid, dispatch, fill]);

  const blocked = !canCheckout(user);

  const onSubmit = async (data) => {
    // 帶上畫面顯示的總計；與後端金額不同時回 409，thunk 會顯示原因並重新讀取購物車
    const form = {
      data: { user: data, message: data.message, final_total },
    };
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
                  {user && blocked && (
                    <div className="alert alert-warning" role="alert">
                      此帳號不能結帳，請改用會員帳號登入
                    </div>
                  )}
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
                    <CartPriceRows />

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
                        (carts?.length == 0 ? true : false) ||
                        isLoading ||
                        blocked
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
                          (carts?.length == 0 ? true : false) ||
                          isLoading ||
                          blocked
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
