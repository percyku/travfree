import { discountLabel } from "../../utils/coupon";

const TITLES = {
  delete: "刪除優惠券",
  edit: "更新優惠券",
  create: "新增優惠券",
};

const AdminCouponModal = ({
  modalRef,
  modalType,
  templateData,
  handleInputChange,
  submitCoupon,
  deleteCoupon,
  closeModal,
}) => {
  return (
    <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {TITLES[modalType] || TITLES.create}
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={closeModal}
            ></button>
          </div>

          <div className="modal-body">
            {modalType === "delete" ? (
              <p className="h5">
                確定要刪除
                <span className="text-danger">{templateData.title}</span>（
                {templateData.code}
                ）嗎？已套用在購物車的優惠會一併移除，歷史訂單不受影響。
              </p>
            ) : (
              <>
                <div className="mb-3">
                  <label htmlFor="title" className="form-label">
                    名稱
                  </label>
                  <input
                    id="title"
                    type="text"
                    className="form-control"
                    placeholder="例如：週年慶八折"
                    value={templateData.title}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="code" className="form-label">
                    優惠碼
                  </label>
                  <input
                    id="code"
                    type="text"
                    className="form-control"
                    placeholder="例如：TEST80"
                    value={templateData.code}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="percent" className="form-label">
                    實付比例（%）
                  </label>
                  <div className="input-group">
                    <input
                      id="percent"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="form-control"
                      value={templateData.percent}
                      onChange={handleInputChange}
                    />
                    <span className="input-group-text">
                      {discountLabel(templateData.percent) || "請輸入 0–100"}
                    </span>
                  </div>
                  <div className="form-text">
                    80 代表顧客付原價的 80%，也就是 8 折
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="due_date" className="form-label">
                    到期日
                  </label>
                  <input
                    id="due_date"
                    type="date"
                    className="form-control"
                    value={templateData.due_date}
                    onChange={handleInputChange}
                  />
                  <div className="form-text">有效到當天 23:59:59</div>
                </div>
                <div className="form-check">
                  <input
                    id="is_enabled"
                    type="checkbox"
                    className="form-check-input"
                    checked={templateData.is_enabled}
                    onChange={handleInputChange}
                  />
                  <label htmlFor="is_enabled" className="form-check-label">
                    啟用
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeModal}
            >
              取消
            </button>
            {modalType === "delete" ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => deleteCoupon(templateData.id)}
              >
                刪除
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitCoupon}
              >
                送出
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCouponModal;
