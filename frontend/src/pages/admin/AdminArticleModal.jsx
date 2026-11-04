import { useState, useEffect, useRef } from "react";
import { Modal } from "bootstrap";
import PicModal from "../../components/PicModal";

const AdminArticleModal = ({
  modalRef,
  modalType,
  templateData,
  tags,
  handleTag,
  handleModalInputChange,
  addOrUpdateArticleData,
  delArticleData,
  closeModal,
}) => {
  const [photoUrl, setPhotoUrl] = useState(
    "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bm90JTIwZm91bmR8ZW58MHx8MHx8fDA%3D",
  );

  const modalRefPic = useRef(null);
  const myModalPic = useRef(null);

  useEffect(() => {
    myModalPic.current = new Modal(modalRefPic.current);
  }, []);

  const getSinglePic = (url) => {
    setPhotoUrl(url);
    if (photoUrl !== "") {
      myModalPic.current.show();
    }
  };

  return (
    <div
      className="modal fade"
      ref={modalRef}
      tabIndex="-1"
      id="exampleModal"
      aria-labelledby="exampleModalLabel"
      aria-hidden="true"
    >
      <PicModal modalRef={modalRefPic} photoUrl={photoUrl} />
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title " id="exampleModalLabel">
              {modalType === "delete"
                ? "刪除產品"
                : modalType === "edit"
                  ? "更新產品"
                  : "新增產品"}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              onClick={() => closeModal()}
            ></button>
          </div>

          <div className="modal-body">
            {modalType === "delete" ? (
              <p className="h4">
                確定要刪除
                <span className="text-danger">{templateData.title}</span>
                嗎?
              </p>
            ) : (
              <div className="row">
                <div className="col-sm-4">
                  {/* <div className="mb-3">
                    <label htmlFor="fileInput" className="form-label">
                      圖片上傳
                    </label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className="form-control"
                      id="fileInput"
                      onChange={handleFileUploadAndChange}
                    />
                  </div> */}

                  <label htmlFor="imageUrl" className="form-label">
                    輸入圖片網址
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="image"
                    placeholder="請輸入圖片連結"
                    defaultValue={templateData.image}
                    onChange={handleModalInputChange}
                  />

                  <img
                    className="img-fluid"
                    src={templateData.image}
                    alt="主圖"
                    onClick={() => getSinglePic(templateData.image)}
                  />
                </div>

                <div className="col-sm-8">
                  <div className="col-sm-6">
                    <div className="mb-2">
                      <label htmlFor="title" className="form-label">
                        標題
                      </label>
                      <input
                        id="title"
                        type="text"
                        className="form-control"
                        placeholder="請輸入標題"
                        value={templateData.title}
                        onChange={handleModalInputChange}
                      />
                    </div>
                  </div>

                  <div className="col-sm-6">
                    <div className="mb-2">
                      <label htmlFor="title" className="form-label">
                        作者
                      </label>
                      <input
                        id="author"
                        type="text"
                        className="form-control"
                        placeholder="請輸入作者"
                        value={templateData.author}
                        onChange={handleModalInputChange}
                      />
                    </div>
                  </div>

                  <hr />
                  <div className="mb-2">
                    <label htmlFor="description" className="form-label">
                      文章描述
                    </label>
                    <textarea
                      id="description"
                      className="form-control"
                      placeholder="請輸入產品描述"
                      value={templateData.description}
                      onChange={handleModalInputChange}
                    ></textarea>
                  </div>

                  <div className="mb-5">
                    {tags?.map((tag, i) => {
                      let isChecked = templateData.tag?.find((item) =>
                        item === tag ? true : false,
                      );
                      return (
                        <div
                          className="form-check form-check-inline"
                          key={tag + "_" + i}
                        >
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={tag}
                            name={tag}
                            checked={isChecked || false}
                            onChange={handleTag}
                          />
                          <label className="form-check-label" htmlFor={tag}>
                            {tag}
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mb-2">
                    <div className="form-check">
                      <input
                        id="isPublic"
                        className="form-check-input"
                        type="checkbox"
                        checked={templateData.isPublic}
                        onChange={handleModalInputChange}
                      />
                      <label className="form-check-label" htmlFor="isPublic">
                        是否啟用
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              data-bs-dismiss="modal"
              onClick={() => closeModal()}
            >
              取消
            </button>
            {modalType === "delete" ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => delArticleData(templateData.id)}
                >
                  刪除
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => addOrUpdateArticleData(templateData.id)}
                >
                  送出
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminArticleModal;
