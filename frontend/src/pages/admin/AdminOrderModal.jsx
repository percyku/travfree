import { discountLabel, summarizeCoupons } from "../../utils/coupon";
import { currency } from "../../utils/filter";

const AdminOrderModal = ({
  modalRef,
  tempOrder,
  readOnly,
  handleModalInputChange,
  updateOrderInfo,
  closeModal,
}) => {
  // 優惠券資訊來自下單當下的快照，之後刪除或修改優惠券都不影響
  const { subtotal, couponDiscount, coupons } = summarizeCoupons(
    tempOrder.products,
  );
  return (
    <div
      className="modal fade"
      tabIndex="-1"
      ref={modalRef}
      id="orderModal"
      aria-labelledby="exampleModalLabel"
      aria-hidden="true"
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5" id="exampleModalLabel">
              {`編輯 ${tempOrder.id}`}
            </h1>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={closeModal}
            />
          </div>
          <div className="modal-body">
            <div className="mb-3 row">
              <span className="col-sm-2 col-form-label">Email</span>
              <div className="col-sm-10">
                <input
                  type="email"
                  readOnly
                  className="form-control-plaintext"
                  id="staticEmail"
                  defaultValue={tempOrder?.user?.email}
                />
              </div>
            </div>
            <div className="mb-3 row">
              <span className="col-sm-2 col-form-label">訂購者</span>
              <div className="col-sm-10">
                <input
                  type="text"
                  readOnly
                  className="form-control-plaintext"
                  id="staticEmail"
                  defaultValue={tempOrder?.user?.name}
                />
              </div>
            </div>
            <div className="mb-3 row">
              <span className="col-sm-2 col-form-label">外送地址</span>
              <div className="col-sm-10">
                <input
                  type="text"
                  readOnly
                  className="form-control-plaintext"
                  defaultValue={tempOrder?.user?.address}
                />
              </div>
            </div>
            <div className="mb-3 row">
              <span className="col-sm-2 col-form-label">留言</span>
              <div className="col-sm-10">
                <textarea
                  name=""
                  id=""
                  cols="30"
                  readOnly
                  className="form-control-plaintext"
                  defaultValue={tempOrder.message}
                />
              </div>
            </div>
            {tempOrder.products && (
              <table className="table">
                <thead>
                  <tr>
                    <th>品項名稱</th>
                    <th>數量</th>
                    <th className="text-end">小計</th>
                    <th className="text-end">折扣後</th>
                    <th>優惠券</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(tempOrder.products).map((cart) => (
                    <tr key={cart.id}>
                      <td>{cart.product.title}</td>
                      <td>{cart.qty}</td>
                      <td className="text-end">${currency(cart.total)}</td>
                      <td className="text-end">
                        ${currency(cart.final_total)}
                      </td>
                      <td>{cart.coupon?.code ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="border-0 text-end">
                      商品小計
                    </td>
                    <td className="border-0 text-end">${currency(subtotal)}</td>
                    <td className="border-0" />
                  </tr>
                  <tr>
                    <td colSpan={3} className="border-0 text-end">
                      優惠券折抵
                    </td>
                    <td className="border-0 text-end text-danger">
                      -${currency(couponDiscount)}
                    </td>
                    <td className="border-0">
                      {coupons.length === 0
                        ? "未使用"
                        : coupons
                            .map(
                              (coupon) =>
                                `${coupon.code}（${coupon.title}，${discountLabel(coupon.percent)}）`,
                            )
                            .join("、")}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="border-0 text-end fw-bold">
                      實付金額
                    </td>
                    <td className="border-0 text-end fw-bold">
                      ${currency(tempOrder.total)}
                    </td>
                    <td className="border-0" />
                  </tr>
                </tfoot>
              </table>
            )}

            <div>
              <h5 className="mt-4">修改訂單狀態</h5>
              {readOnly && (
                <p className="alert alert-warning" role="alert">
                  這是你自己下的訂單，不能修改付款與外送狀態，請由其他管理者處理。
                </p>
              )}
              <div className="form-check mb-4">
                <label className="form-check-label" htmlFor="is_paid">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    name="is_paid"
                    id="is_paid"
                    checked={!!tempOrder.is_paid}
                    onChange={handleModalInputChange}
                    disabled={readOnly}
                  />
                  付款狀態 ({tempOrder.is_paid ? "已付款" : "未付款"})
                </label>
              </div>
              <div className="mb-4">
                <span className="col-sm-2 col-form-label d-block">
                  外送進度
                </span>
                <select
                  className="form-select"
                  name="status"
                  value={tempOrder.status}
                  onChange={handleModalInputChange}
                  disabled={readOnly}
                >
                  <option value={0}>未確認</option>
                  <option value={1}>已確認</option>
                  <option value={2}>外送中</option>
                  <option value={3}>已送達</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeModal}
            >
              關閉
            </button>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={updateOrderInfo}
              >
                儲存
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderModal;
