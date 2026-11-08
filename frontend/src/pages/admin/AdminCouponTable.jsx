import { discountLabel, isExpired } from "../../utils/coupon";

const AdminCouponTable = ({ coupons, openModal }) => {
  return (
    <div className="container">
      <div className="text-end mt-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openModal({}, "create")}
        >
          建立新的優惠券
        </button>
      </div>
      <table className="table mt-4">
        <thead>
          <tr>
            <th scope="col">名稱</th>
            <th scope="col">優惠碼</th>
            <th scope="col">折扣</th>
            <th scope="col">到期日</th>
            <th scope="col">狀態</th>
            <th scope="col">編輯</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td>{coupon.title}</td>
              <td>
                <code>{coupon.code}</code>
              </td>
              <td>
                付 {coupon.percent}%（{discountLabel(coupon.percent)}）
              </td>
              <td>
                {/* due_date 是 Unix 秒 */}
                {new Date(coupon.due_date * 1000).toLocaleDateString()}
                {isExpired(coupon.due_date) && (
                  <span className="badge bg-secondary ms-2">已過期</span>
                )}
              </td>
              <td>
                {coupon.is_enabled ? (
                  <span className="text-success">啟用</span>
                ) : (
                  <span className="text-muted">停用</span>
                )}
              </td>
              <td>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => openModal(coupon, "edit")}
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => openModal(coupon, "delete")}
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {coupons.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted">
                目前沒有優惠券
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminCouponTable;
