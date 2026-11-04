import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { createAsyncAddCart } from "../../slice/cartSlice";
import {
  updateTempInfo,
  createAsyncGetAllProducts,
  createAsyncGetProducts,
} from "../../slice/productSlice";
import Pagination from "../../components/Pagination";

const Product = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const isCartLoading = useSelector((state) => state.cart.isLoading);
  const isProductLoading = useSelector((state) => state.product.isLoading);
  const products = useSelector((state) => state.product.products);
  const pagination = useSelector((state) => state.product.pagination);
  const categories = useSelector((state) => state.product.categories);

  const tempCategory = useSelector((state) => state.product.tempCategory);
  const tempPage = useSelector((state) => state.product.tempPage);

  const [currentCategory, setCurrentCategory] = useState(
    tempCategory !== "all" ? tempCategory : "all",
  );
  const [currentPage, setCurrentPage] = useState(tempPage !== 0 ? tempPage : 1);
  useEffect(() => {
    dispatch(createAsyncGetAllProducts());
    if (tempPage !== 0) {
      dispatch(
        createAsyncGetProducts({
          page: tempPage,
          category: tempCategory,
        }),
      );

      dispatch(
        updateTempInfo({
          tempCategory: "all",
          tempPage: 0,
        }),
      );
    } else {
      dispatch(
        createAsyncGetProducts({
          page: 1,
          category: currentCategory,
        }),
      );
    }
  }, [currentCategory]);

  const handleAddCart = (id, qty = 1) => {
    dispatch(createAsyncAddCart({ id, qty }));
  };

  const changePage = useCallback(
    (e, page) => {
      e.preventDefault();
      setCurrentPage(page);

      dispatch(
        createAsyncGetProducts({
          page: page,
          category: currentCategory,
        }),
      );
      window.scrollTo(0, 0);
    },
    [currentCategory],
  );

  const getMoreInfo = async (id) => {
    dispatch(
      updateTempInfo({
        tempCategory: currentCategory,
        tempPage: currentPage,
      }),
    );
    navigate(`/product/${id}`);
  };

  return (
    <>
      <div className="margin-top travel-bg ">
        <section className="index-inspire ">
          <div className="container py-10 py-lg-11">
            <div className="row justify-content-between align-items-center">
              <div className="col-12 col-lg-5">
                <h3 className="text-primary mb-7 text-start">
                  今年旅行的 <br />
                  靈感地圖
                </h3>

                <div className="d-flex overflow-x-auto mb-7">
                  {categories.map((category) => {
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`rounded rounded-3 py-2 px-5  me-2 flex-shrink-0 ${category === currentCategory ? "btn btn-primary" : "btn btn-light"}`}
                        // className="btn btn-primary rounded rounded-3 py-2 px-5 flex-shrink-0"
                        disabled={isCartLoading || isProductLoading}
                        onClick={() => {
                          setCurrentCategory(category);
                        }}
                      >
                        {category === "all" ? "全部" : category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="col-12 col-lg-5 d-flex justify-content-lg-end">
                <div>
                  <p className="text-primary">
                    來自旅人搜尋、收藏與討論最多的目的地排行榜， <br />
                    一場風格與故事感兼具的靈感旅行，就從這裡開始。
                  </p>
                </div>
              </div>
            </div>

            <div className="row pt-11">
              {products.map((product) => {
                return (
                  <div className="col-md-6 mb-7" key={product.id}>
                    <div className="card bg-white rounded-5 p-7 flex-shrink-0 position-relative ">
                      <button
                        type="button"
                        className="btn border-0 d-none d-lg-block position-absolute top-10 start-90 translate-middle-y z-1"
                        disabled={isCartLoading || isProductLoading}
                        onClick={() => handleAddCart(product.id)}
                      >
                        <span className="material-icons-outlined align-bottom">
                          shopping_cart
                        </span>
                      </button>

                      <button
                        type="button"
                        className="btn border-0  d-lg-none position-absolute top-10 start-80 translate-middle-y z-1"
                        disabled={isCartLoading || isProductLoading}
                        onClick={() => handleAddCart(product.id)}
                      >
                        <span className="material-icons-outlined align-bottom">
                          shopping_cart
                        </span>
                      </button>

                      <div className="row justify-content-center align-items-center">
                        <div className="col-12 col-lg-5 mb-2 mb-lg-0">
                          <img
                            src={product.imageUrl}
                            className="w-100 object-fit-cover rounded-4 d-block border"
                            alt="map-1"
                          />
                        </div>
                        <div className="col-12 col-lg-7">
                          <div className="d-lg-flex flex-lg-column justify-content-lg-start h-100 text-primary">
                            <div className="mb-2 text-start">
                              <button
                                type="button"
                                className="btn btn-primary-10 rounded rounded-3 py-2 px-5 flex-shrink-0"
                              >
                                {product.category}
                              </button>
                            </div>

                            <h2 className="text-start"> {product.title}</h2>

                            <p className="text-start mb-7 line-clamp-2">
                              {product.content}
                            </p>

                            <div className="mb-2 d-flex  justify-content-start  align-items-lg-center  mb-7">
                              <button
                                type="button"
                                className="btn btn-primary-10 rounded rounded-3 py-2 px-5 flex-shrink-0 me-4 h-25"
                              >
                                建議
                              </button>
                              <p className="text-start line-clamp-2">
                                {product.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary-120 w-100 rounded-pill d-flex justify-content-between align-items-center py-5"
                              disabled={isCartLoading || isProductLoading}
                              onClick={() => getMoreInfo(product.id)}
                            >
                              立即探索
                              <span className="material-icons-outlined rounded-circle bg-white text-primary p-1 align-bottom ms-2">
                                arrow_forward
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <div className="d-flex justify-content-center">
          <Pagination
            pagination={pagination}
            changePage={changePage}
            loadingProductId={null}
          />
        </div>
      </div>
    </>
  );
};

export default Product;
