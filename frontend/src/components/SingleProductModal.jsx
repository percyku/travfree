import { memo } from "react";

const SingleProductModal = memo(
  ({ product, setCartQuantity, cartQuantity, addCart, closeModal }) => {
    return (
      <div className="modal" id="productModal">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">產品名稱：{product.title}</h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={closeModal}
              ></button>
            </div>
            <div className="modal-body">
              <img className="w-100" src={product.imageUrl} />
              <p className="mt-3">產品內容：{product.content}</p>
              <p>產品描述：{product.description}</p>
              <p>
                價錢：<del>原價 ${product.origin_price}</del>，特價：$
                {product.price}
              </p>
              <div className="d-flex align-items-center">
                <label style={{ width: "150px" }}>購買數量：</label>
                <button
                  className="btn btn-danger"
                  type="button"
                  id="button-addon1"
                  aria-label="Decrease quantity"
                  onClick={() =>
                    setCartQuantity((pre) => (pre === 1 ? pre : pre - 1))
                  }
                >
                  <i className="fa-solid fa-minus"></i>
                </button>
                <input
                  className="form-control"
                  type="number"
                  value={cartQuantity}
                  min="1"
                  max="10"
                  onChange={(e) => setCartQuantity(Number(e.target.value))}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  id="button-addon2"
                  aria-label="Decrease quantity"
                  onClick={() => setCartQuantity((pre) => pre + 1)}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addCart(product.id, cartQuantity)}
              >
                加入購物車
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default SingleProductModal;
