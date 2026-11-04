import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Modal } from "bootstrap";
import AdminArticleTable from "./AdminArticleTable";
import AdminArticleModal from "./AdminArticleModal";
import Loading from "../../components/Loading";
import Pagination from "../../components/Pagination";
import useMessage from "../../hooks/useMessage";

const { VITE_APP_API_BASE, VITE_APP_API_PATH } = import.meta.env;

const AdminArticle = () => {
  const { showSuccess, showError } = useMessage();

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [isAuth, setIsAuth] = useState(true);
  const [articles, setArticles] = useState([]);
  const [pagination, setPagiantion] = useState({
    total_pages: 0,
    current_page: 0,
    has_pre: false,
    has_next: false,
    category: "",
  });
  const modalRef = useRef(null);
  const articleModalRef = useRef(null);
  const [templateData, setTemplateData] = useState({
    author: "alice",
    create_at: 123455,
    description: "123",
    id: "-MT-RbUo-e-d3RZIS_kJ",
    image:
      "https://images.unsplash.com/photo-1515865644861-8bedc4fb8344?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxleHBsb3JlLWZlZWR8Mnx8fGVufDB8fHx8fA%3D%3D",
    isPublic: false,
    tag: [],
    title: "title1234",
    num: 1,
    content: "default",
  });
  const [modalType, setModalType] = useState("");
  const tags = ["亞洲", "歐洲", "美洲"];

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/articles`,
        );
        setArticles(res.data.articles);
        setPagiantion(res.data.pagination);
      } catch (error) {
        showError("取得資料失敗，請重新登入");
        setIsAuth(false);
      } finally {
      }
    })();

    articleModalRef.current = new Modal(modalRef.current, {
      backdrop: "static",
      keyboard: false,
    });

    // Modal 關閉時移除焦點
    modalRef.current.addEventListener("hide.bs.modal", () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
  }, []);

  useEffect(() => {
    if (!isAuth) {
      navigate("/login");
    }
  }, [isAuth]);

  const openModal = (article, type) => {
    setTemplateData({
      author: article.author || "",
      create_at: article.create_at || 123455,
      description: article.description || "",
      id: article.id || "",
      image:
        article.image ||
        "https://images.unsplash.com/photo-1515865644861-8bedc4fb8344?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxleHBsb3JlLWZlZWR8Mnx8fGVufDB8fHx8fA%3D%3D",
      isPublic: article.isPublic || false,
      tag: article.tag || [],
      title: article.title || "",
      num: article.num || -1,
      content: article.content || "default",
    });
    articleModalRef.current.show();

    setModalType(type);
  };

  const closeModal = () => {
    articleModalRef.current.hide();
  };

  // const handleFileUploadAndChange = async (e) => {
  //   const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/upload`;

  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   try {
  //     // setIsLoading(true);
  //     const formData = new FormData();
  //     formData.append("file-to-upload", file);

  //     let res = await axios.post(url, formData);
  //     const uploadedImageUrl = res.data.imageUrl;
  //     showSuccess("Upload success:");
  //     setTemplateData((prevTemplateData) => ({
  //       ...prevTemplateData,
  //       imageUrl: uploadedImageUrl,
  //     }));
  //   } catch (error) {
  //     showError(`Upload error: ${error}`);
  //   } finally {
  //     // setIsLoading(false);
  //   }
  // };

  const handleModalInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setTemplateData((prevData) => ({
      ...prevData,
      [id]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTag = (e) => {
    const { name, checked } = e.target;
    setTemplateData((prevData) => {
      let newTags = [...prevData.tag];

      if (checked) {
        newTags.push(name);
      } else {
        newTags = newTags.filter((item) => item !== name);
      }
      return { ...prevData, tag: newTags };
    });
  };

  //處理Pagination page 當前數值
  const changePage = useCallback((e, page) => {
    e.preventDefault();
    getArticleInfo(page);
  }, []);

  const getArticleInfo = async (page = 1) => {
    try {
      setIsLoading(true);
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/articles?page=${page}`,
      );

      setArticles(res.data.articles);
      setPagiantion(res.data.pagination);
    } catch (error) {
      showError("取得資料失敗，請重新登入");
      setIsAuth(false);
    } finally {
      setIsLoading(false);
    }
  };

  const addOrUpdateArticleData = async (id) => {
    const articleData = {
      data: {
        ...templateData,
      },
    };

    let article;
    if (modalType === "edit") {
      article = `article/${id}`;
    } else {
      articleData.data.create_at = Date.now();
      article = `article`;
    }

    const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/${article}`;

    try {
      setIsLoading(true);
      let res;
      if (modalType === "edit") {
        res = await axios.put(url, articleData);
      } else {
        res = await axios.post(url, articleData);
      }
      showSuccess(res.data.message);
      articleModalRef.current.hide();
      getArticleInfo();
    } catch (error) {
      if (modalType === "edit") {
        showError(`更新失敗!`);
      } else {
        showError(`新增失敗! `);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const delArticleData = async (id) => {
    try {
      setIsLoading(true);
      const res = await axios.delete(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/article/${id}`,
      );
      showSuccess(res.data.message);
      articleModalRef.current.hide();
      getArticleInfo();
    } catch (error) {
      showError(`刪除失敗! ${error.response.data.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AdminArticleModal
        modalRef={modalRef}
        modalType={modalType}
        templateData={templateData}
        tags={tags}
        handleTag={handleTag}
        handleModalInputChange={handleModalInputChange}
        addOrUpdateArticleData={addOrUpdateArticleData}
        delArticleData={delArticleData}
        closeModal={closeModal}
      />

      <AdminArticleTable articles={articles} openModal={openModal} />
      <div className="d-flex justify-content-center">
        <Pagination
          pagination={pagination}
          changePage={changePage}
          loadingProductId={null}
        />
      </div>
      <Loading isLoading={isLoading} />
    </>
  );
};

export default AdminArticle;
