import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Modal } from "bootstrap";
import AdminProductTable from "./AdminProductTable";
import AdminProductModal from "./AdminProductModal";
import Loading from "../../components/Loading";
import Pagination from "../../components/Pagination";
import useMessage from "../../hooks/useMessage";

const { VITE_APP_API_BASE, VITE_APP_API_PATH } = import.meta.env;

function AdminProducts() {
  const { showSuccess, showError } = useMessage();

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);

  const [isAuth, setIsAuth] = useState(true);

  const [products, setProducts] = useState([]);
  const [pagination, setPagiantion] = useState({
    total_pages: 0,
    current_page: 0,
    has_pre: false,
    has_next: false,
    category: "",
  });

  const modalRef = useRef(null);
  const productModalRef = useRef(null);
  const [modalType, setModalType] = useState("");
  const [templateData, setTemplateData] = useState({
    id: "",
    imageUrl:
      "https://images.unsplash.com/photo-1515865644861-8bedc4fb8344?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxleHBsb3JlLWZlZWR8Mnx8fGVufDB8fHx8fA%3D%3D",
    title: "",
    category: "",
    unit: "",
    origin_price: "",
    price: "",
    description: "",
    content: "",
    is_enabled: false,
    imagesUrl: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/products?page=1`,
        );

        // console.log(res.data);
        setProducts(res.data.products);
        setPagiantion(res.data.pagination);
      } catch (error) {
        showError("取得資料失敗，請重新登入");
        setIsAuth(false);
      } finally {
      }
    })();

    productModalRef.current = new Modal(modalRef.current, {
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

  const openModal = (product, type) => {
    setTemplateData({
      id: product.id || "",
      imageUrl:
        product.imageUrl ||
        "https://images.unsplash.com/photo-1515865644861-8bedc4fb8344?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxleHBsb3JlLWZlZWR8Mnx8fGVufDB8fHx8fA%3D%3D",
      title: product.title || "",
      category: product.category || "",
      unit: product.unit || "",
      origin_price: product.origin_price || "",
      price: product.price || "",
      description: product.description || "",
      content: product.content || "",
      is_enabled: product.is_enabled || false,
      imagesUrl: product.imagesUrl || [],
    });
    productModalRef.current.show();

    setModalType(type);
  };

  const closeModal = () => {
    productModalRef.current.hide();
  };

  const handleModalInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setTemplateData((prevData) => ({
      ...prevData,
      [id]: type === "checkbox" ? checked : value,
    }));
  };

  //當副圖輸入值，會新增入陣列
  const handleImageChange = (index, value) => {
    setTemplateData((prevData) => {
      const newImages = [...prevData.imagesUrl];
      newImages[index] = value;

      return { ...prevData, imagesUrl: newImages };
    });
  };

  //新增副圖的邏輯
  const handleAddImage = () => {
    setTemplateData((prevData) => ({
      ...prevData,
      imagesUrl: [...prevData.imagesUrl, ""],
    }));
  };
  //刪除副圖的邏輯
  const handleRemoveImage = () => {
    setTemplateData((prevData) => {
      const newImages = [...prevData.imagesUrl];
      newImages.pop();
      return { ...prevData, imagesUrl: newImages };
    });
  };

  //處理Pagination page 當前數值
  const changePage = useCallback((e, page) => {
    e.preventDefault();
    getProductInfo(page);
  }, []);

  const getProductInfo = async (page = 1) => {
    try {
      setIsLoading(true);
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/products?page=${page}`,
      );
      setProducts(res.data.products);
      setPagiantion(res.data.pagination);
    } catch (error) {
      showError(error.response.data.message);
      setIsAuth(false);
    } finally {
      setIsLoading(false);
    }
  };

  const addOrUpdateProductData = async (id) => {
    const productData = {
      data: {
        ...templateData,
        origin_price: Number(templateData.origin_price),
        price: Number(templateData.price),
        is_enabled: templateData.is_enabled ? 1 : 0,
        imagesUrl: [...templateData.imagesUrl].filter((image) => image !== ""),
      },
    };

    let product;
    if (modalType === "edit") {
      product = `product/${id}`;
    } else {
      product = `product`;
    }

    const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/${product}`;
    try {
      setIsLoading(true);
      let res;
      if (modalType === "edit") {
        res = await axios.put(url, productData);
      } else {
        res = await axios.post(url, productData);
      }
      showSuccess(res.data.message);
      productModalRef.current.hide();
      getProductInfo();
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

  const delProductData = async (id) => {
    try {
      setIsLoading(true);
      const res = await axios.delete(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/product/${id}`,
      );
      showSuccess(res.data.message);
      productModalRef.current.hide();
      getProductInfo();
    } catch (error) {
      showError(`刪除失敗! ${error.response.data.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUploadAndChange = async (e) => {
    const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/admin/upload`;

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("file-to-upload", file);

      let res = await axios.post(url, formData);
      const uploadedImageUrl = res.data.imageUrl;
      showSuccess("Upload success:");
      setTemplateData((prevTemplateData) => ({
        ...prevTemplateData,
        imageUrl: uploadedImageUrl,
      }));
    } catch (error) {
      showError(`Upload error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AdminProductModal
        modalRef={modalRef}
        modalType={modalType}
        templateData={templateData}
        handleModalInputChange={handleModalInputChange}
        handleImageChange={handleImageChange}
        handleAddImage={handleAddImage}
        handleRemoveImage={handleRemoveImage}
        handleFileUploadAndChange={handleFileUploadAndChange}
        delProductData={delProductData}
        addOrUpdateProductData={addOrUpdateProductData}
        closeModal={closeModal}
      />
      <div className="mb-5">
        <AdminProductTable products={products} openModal={openModal} />
      </div>
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
}

export default AdminProducts;
