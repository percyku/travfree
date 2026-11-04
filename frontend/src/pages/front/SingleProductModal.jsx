import { memo } from "react";

const SingleProductModal = memo(({ product, closeModal }) => {
  return (
    <div className="modal" id="productModal">
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <span className="fw-bold fs-4">{product.title}</span>
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              onClick={closeModal}
            ></button>
          </div>
          <div className="modal-body">
            <div className="row">
              <div className="col-lg-6">
                <img className="w-100 mb-4" src={product.imageUrl} />
              </div>
              <div className="col-lg-6">
                <div className="text-start">
                  <div className="d-flex mb-2">
                    <p className="card-text  text-secondary me-3">
                      原價：<del>{product.origin_price}</del>
                    </p>
                    /
                    <span className="ms-3 fs-5 fw-bold text-primary-60">
                      特價： {product.price}
                    </span>
                  </div>
                  <div className="text-start">
                    <div className="mb-7">
                      <p className="card-text fs-4 fw-bold">商品描述(建議)：</p>
                      <p className="card-text">{product.description}</p>
                    </div>
                    <div className="mb-7">
                      <p className="card-text fs-4 fw-bold">商品內容：</p>
                      <p className="card-text">{product.content}</p>
                    </div>
                  </div>
                </div>{" "}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SingleProductModal;
