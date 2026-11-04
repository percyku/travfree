import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Modal } from "bootstrap";
import PicModal from "../../components/PicModal";
import { createAsyncAddCart } from "../../slice/cartSlice";
import { createAsyncGetProduct } from "../../slice/productSlice";

const SingleProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const isProductLoading = useSelector((state) => state.product.isLoading);
  const isCartLoading = useSelector((state) => state.cart.isLoading);
  const product = useSelector((state) => state.product.product);

  const modalRefPic = useRef(null);
  const myModalPic = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(
    "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bm90JTIwZm91bmR8ZW58MHx8MHx8fDA%3D",
  );

  useEffect(() => {
    dispatch(createAsyncGetProduct(id));
    myModalPic.current = new Modal(modalRefPic.current);
  }, [id]);

  const handleAddCart = (id, qty = 1) => {
    dispatch(createAsyncAddCart({ id, qty }));
  };
  const getSinglePic = (url) => {
    setPhotoUrl(url);
    if (photoUrl !== "") {
      myModalPic.current.show();
    }
  };

  const goBack = () => {
    navigate(`/product`);
  };

  return (
    <div className="margin-top travel-bg ">
      <div className="container">
        <div className="d-flex py-2">
          <button
            className="btn btn-outline-primary rounded-3 "
            type="button"
            onClick={goBack}
            disabled={isProductLoading || isCartLoading}
          >
            回上一頁
          </button>
        </div>
        {/* <Loading isLoading={isProductLoading || isCartLoading} /> */}
        <PicModal modalRef={modalRefPic} photoUrl={photoUrl} />

        {product ? (
          <div className="row ">
            <div className="col-lg-7">
              <div className="card mb-3">
                {product.imageUrl !== "" ? (
                  <img
                    src={product.imageUrl}
                    className="img-cover"
                    alt={`${product.title}_旅遊主圖`}
                    onClick={() => getSinglePic(product.imageUrl)}
                  />
                ) : (
                  <>
                    <div
                      className="d-flex justify-content-center align-items-center"
                      style={{ minHeight: "50vh" }}
                    >
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card mb-3">
                <div className="card-body">
                  <div className="row mb-5">
                    <div className="col-7 ">
                      <div className="d-flex align-items-center">
                        <h5 className="card-title h3 text-start">
                          {product.title}
                        </h5>
                        <span className="badge bg-primary ms-3 h-50">
                          {product.category}
                        </span>
                      </div>
                    </div>
                    <div className="col-5  h-50  d-flex justify-content-end ">
                      <button
                        className="btn btn-primary "
                        disabled={isCartLoading || isProductLoading}
                        onClick={() => handleAddCart(product.id)}
                      >
                        立即購買
                      </button>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-12">
                      <div className="d-flex align-items-center mb-3">
                        <div className="d-flex mb-3">
                          <p className="card-text text-secondary me-3">
                            原價：<del>{product.origin_price}</del>
                          </p>
                          /
                          <span className="ms-3 fs-5 fw-bold text-primary-60">
                            特價： {product.price}
                          </span>
                        </div>
                      </div>
                      <div className="text-start">
                        <div className="mb-7">
                          <p className="card-text fs-4 fw-bold">
                            商品描述(建議)：
                          </p>
                          <p className="card-text">{product.description}</p>
                        </div>
                        <div className="mb-7">
                          <p className="card-text fs-4 fw-bold">商品內容：</p>
                          <p className="card-text">{product.content}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h5 className="mt-3">更多圖片：</h5>

                  <div className="d-flex flex-wrap">
                    <div className="row">
                      {product.imagesUrl?.map((url, index) => (
                        <div className="col-4 mt-3" key={index}>
                          <img
                            src={url}
                            className="images img-cover"
                            width="80%"
                            height="80"
                            alt={`旅遊更多圖片_${index + 1}`}
                            onClick={() => getSinglePic(url)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>沒有可用的產品資料。</div>
        )}
      </div>
    </div>
  );
};

export default SingleProduct;
