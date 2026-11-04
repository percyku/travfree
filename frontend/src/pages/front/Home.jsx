import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
const Home = () => {
  const navigate = useNavigate();

  const articles = useSelector((state) => state.article.articles);
  const {
    register,
    handleSubmit,
    formState: { errors },
    // reset,
  } = useForm({
    mode: "onClick",
    defaultValues: {
      search: "",
    },
  });

  const onSubmit = async (data) => {
    const { search } = data;
    navigate(`/searchproduct/${search}`);
  };

  const getMoreInfo = async (id) => {
    navigate(`/article/${id}`);
  };
  return (
    <main>
      <section className="index-banner">
        <div className="container">
          <div className="row">
            <div className="col-lg-10 d-flex align-items-start flex-column">
              <h2 className="fs-5 fw-bold text-primary bg-white rounded-1 p-2 d-inline-block mb-4 ">
                FreeTrav 旅行推薦平台
              </h2>
              <h1 className="fw-bold text-primary text-start">
                <span className="d-block d-lg-inline">用旅行，</span>
                <span> 收藏世界的樣子 </span>
              </h1>

              <p className="text-primary fs-6 text-start">
                FreeTrav
                整合熱門景點推薦、即時優惠、獨家行程，從比價到訂購，一次完成你的完美出遊計畫。
              </p>
            </div>

            <div className="col-lg-5">
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
                    {...register("search", {
                      required: "請輸入景點、地點或城市。",
                      minLength: {
                        value: 1,
                        message: "不能空白",
                      },
                    })}
                  />

                  <button className="btn btn-primary position-absolute flex-shrink-0 top-50 start-70 translate-middle-y">
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
        </div>
      </section>

      <section className="index-recommend py-10">
        <div className="container text-white mb-10 d-lg-flex justify-content-lg-between align-items-lg-center">
          <h3 className="mb-7 text-start">
            你的
            <br />
            專屬推薦文章
          </h3>
          <div>
            <p className="mb-4 text-start">
              來看我們的精選推薦行程，滿意度高達 87.5% <br />
              給自己一個難忘的旅遊行程吧！
            </p>
          </div>
        </div>

        <div className="container d-flex gap-5 overflow-x-auto">
          {articles?.map((article, i) => {
            const disable = i === 4 ? "d-lg-none" : "";
            return (
              <div
                className={`card text-bg-dark rounded-5 overflow-hidden flex-shrink-0 flex-lg-shrink-1 ${disable}`}
                key={article.id}
              >
                <img
                  src={article.image}
                  className="card-img-top h-100"
                  alt="recommend"
                />
                <div className="card-img-overlay d-flex flex-column justify-content-end text-start">
                  <h4 className="mb-2">{article.title}</h4>
                  <p className="mb-7 line-clamp-2 ">{article.description}</p>
                  <button
                    type="button"
                    className="btn btn-light p-6 rounded-pill d-flex justify-content-between"
                    onClick={() => getMoreInfo(article.id)}
                  >
                    查看文章
                    <span className="material-icons-outlined align-bottom">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default Home;
