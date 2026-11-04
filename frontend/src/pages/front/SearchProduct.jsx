import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { createAsyncAddCart } from "../../slice/cartSlice";
import {
  createAsyncGetSearchProducts,
  updateTempInfo,
} from "../../slice/productSlice";
import { useEffect } from "react";
const SearchProduct = () => {
  const { search } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isCartLoading = useSelector((state) => state.cart.isLoading);
  const isProductLoading = useSelector((state) => state.product.isLoading);
  const products = useSelector((state) => state.product.products);
  const {
    register,
    handleSubmit,
    formState: { errors },
    // reset,
  } = useForm({
    mode: "onClick",
    defaultValues: {
      search: search,
    },
  });

  useEffect(() => {
    dispatch(createAsyncGetSearchProducts(search));
  }, [search]);

  const onSubmit = async (data) => {
    const { search } = data;
    dispatch(createAsyncGetSearchProducts(search));
    // navigate(`/searchproduct/${search}`);
  };
  const goBack = () => {
    navigate(`/product`);
  };

  const handleAddCart = (id, qty = 1) => {
    dispatch(createAsyncAddCart({ id, qty }));
  };

  const getMoreInfo = async (id) => {
    dispatch(updateTempInfo({ tempCategory: "", tempPage: "" }));
    navigate(`/product/${id}`);
  };

  return (
    <>
      <div className="margin-top travel-bg ">
        <section className="index-inspire ">
          <div className="container py-10 ">
            <div className="row">
              <div className="d-flex py-2 mb-5">
                <button
                  className="btn btn-outline-primary rounded-3 "
                  type="button"
                  onClick={goBack}
                  // disabled={isProductLoading || isCartLoading}
                >
                  全部行程
                </button>
              </div>
              <div className="col-lg-5 col-md-7">
                <form
                  className="position-relative"
                  onSubmit={handleSubmit(onSubmit)}
                >
                  <div>
                    <span className="material-icons-outlined align-bottom position-relative position-absolute top-50 start-0 translate-middle-y ps-4 text-neutral-60">
                      search
                    </span>
                    <input
                      name="search"
                      type="search"
                      className="form-control rounded-3 py-4 ps-10"
                      id="navbar-lg-search"
                      placeholder="搜尋景點、地點或城市"
                      defaultValue={search}
                      {...register("search", {
                        required: "請輸入景點、地點或城市。",
                        minLength: {
                          value: 1,
                          message: "不能空白",
                        },
                      })}
                    />

                    <button
                      className="btn btn-primary position-absolute flex-shrink-0 top-50 start-65  d-lg-none translate-middle-y "
                      disabled={isCartLoading || isProductLoading}
                    >
                      開始探索旅程
                    </button>

                    <button
                      className="btn btn-primary position-absolute flex-shrink-0 top-50 start-70  d-none d-lg-block translate-middle-y "
                      disabled={isCartLoading || isProductLoading}
                    >
                      開始探索旅程
                    </button>
                  </div>
                </form>
                {errors.search && (
                  <p className="text-alert mt-3 text-start">
                    {errors.search.message}
                  </p>
                )}
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
                              {product.description}
                            </p>

                            <div className="mb-2 d-flex  justify-content-start  align-items-lg-center  mb-7">
                              <button
                                type="button"
                                className="btn btn-primary-10 rounded rounded-3 py-2 px-5 flex-shrink-0 me-4 h-25"
                              >
                                建議
                              </button>
                              <p className="text-start line-clamp-2">
                                {product.content}
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
      </div>
    </>
  );
};

export default SearchProduct;
