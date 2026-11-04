import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { createAsyncGetArticle } from "../../slice/articleSlice";
const SingleArticle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const article = useSelector((state) => state.article.article);
  const goBack = () => {
    navigate(`/`);
  };
  useEffect(() => {
    dispatch(createAsyncGetArticle(id));
  }, [id]);
  return (
    <div className="margin-top travel-bg ">
      <div className="container">
        <div className="d-flex py-2">
          <button
            className="btn btn-outline-primary rounded-3 "
            type="button"
            onClick={goBack}
            // disabled={isProductLoading || isCartLoading}
          >
            回上一頁
          </button>
        </div>

        {article ? (
          <div className="row">
            <div className="col-lg-7">
              <div className="card mb-3">
                {article?.image !== "" && article?.image !== undefined ? (
                  <img
                    src={article.image}
                    className="img-cover"
                    alt={`${article.title}_文章 ${article?.image}`}
                  />
                ) : (
                  <>
                    <div
                      className="d-flex justify-content-center align-items-center"
                      style={{ minHeight: "25vh" }}
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
                  <div className="d-flex align-items-center">
                    <h5 className="card-title h3 text-start">
                      {article.title}
                    </h5>
                    {article.tag &&
                      article.tag.map((item, i) => {
                        return (
                          <span
                            className="badge bg-primary ms-3 h-50"
                            key={item + "_" + i}
                          >
                            {item}
                          </span>
                        );
                      })}
                  </div>
                  <div className="d-flex align-items-center mb-5">
                    <p className="fs-5">作者：{article.author}</p>
                    <p className="ms-3">
                      {" "}
                      {new Date(article.create_at).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-start fs-5">{article.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>沒有此文章資料。</div>
        )}
      </div>
    </div>
  );
};

export default SingleArticle;
