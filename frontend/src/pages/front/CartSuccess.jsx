import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createAsyncGetOrder } from "../../slice/orderSlice";
function CartSuccess() {
  const { orderId } = useParams();
  const dispatch = useDispatch();
  const orders = useSelector((state) => state.order.orders);

  useEffect(() => {
    dispatch(createAsyncGetOrder(orderId));
  }, [orderId]);
  return (
    <div className="margin-top cart-bg ">
      <div
        style={{
          minHeight: "480px",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundImage:
            "url(https://images.unsplash.com/photo-1558285549-2a06f9a5fe65?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
          backgroundPosition: "center center",
        }}
      ></div>
      <div className="mt-5 ">
        <div className="row py-10 px-10">
          <div className="col-md-6">
            <h2>商品選購成功</h2>
            <p className="text-muted">
              親愛的顧客，感謝您在本平台購物。我們非常感激您對我們的信任和支持，讓我們有機會為您提供優質的服務。
            </p>
            <p className="text-muted">感謝您選擇本平台，祝您生活愉快！</p>
            <Link to="/" className="btn btn-outline-dark me-2 rounded-0 mb-4">
              回到首頁
            </Link>
          </div>
          <div className="col-md-6">
            <div className="card bg-white rounded-2 border-0">
              <div className="card-header border-bottom-0 bg-white px-4 py-1">
                <h2>選購商品細節</h2>
              </div>
              <div className="card-body px-4 py-0">
                <ul className="list-group list-group-flush">
                  {Object.values(orders?.products || {}).map((item) => {
                    return (
                      <li className="list-group-item px-0" key={item.id}>
                        <div className="d-flex mt-2">
                          <img
                            src={item.product.imageUrl}
                            alt=""
                            className="me-2"
                            style={{ width: "60px", height: "60px" }}
                          />
                          <div className="w-100 d-flex flex-column">
                            <div className="d-flex justify-content-between fw-bold">
                              <h5>{item.product.title}</h5>
                              <p className="mb-0">x{item.qty}</p>
                            </div>
                            <div className="d-flex justify-content-between mt-auto">
                              <p className="text-muted mb-0">
                                <small>NT${item.product.price}</small>
                              </p>
                              <p className="mb-0">NT${item.final_total}</p>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  <li className="list-group-item px-0 pb-0 mb-4">
                    <div className="d-flex justify-content-between mt-2">
                      <p className="mb-0 h4 fw-bold">總計</p>
                      <p className="mb-0 h4 fw-bold">NT${orders.total}</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartSuccess;
