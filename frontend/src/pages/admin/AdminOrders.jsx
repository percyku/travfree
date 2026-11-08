import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Modal } from "bootstrap";

import AdminOrderModal from "./AdminOrderModal";
import AdminOrderTable from "./AdminOrderTable";
import Pagination from "../../components/Pagination";
import Loading from "../../components/Loading";
import useMessage from "../../hooks/useMessage";

const { VITE_APP_API_BASE } = import.meta.env;
const AdminOrders = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useMessage();

  const [isLoading, setIsLoading] = useState(false);
  const [isAuth, setIsAuth] = useState(true);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    total_pages: 0,
    current_page: 0,
    has_pre: false,
    has_next: false,
    category: "",
  });

  const modalRef = useRef(null);
  const orderModalRef = useRef(null);
  const [tempOrder, setTempOrder] = useState({
    create_at: 1770813949,
    id: "-OlBj7IIIL9KwwSHKXjT",
    is_paid: false,
    num: 2,
    products: [],
    total: 0,
    user: {},
  });

  useEffect(() => {
    if (!isAuth) {
      navigate("/login");
    }
  }, [isAuth, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(
          `${VITE_APP_API_BASE}/api/admin/orders?page=1`,
        );
        setOrders(res.data.orders);
        setPagination(res.data.pagination);
      } catch {
        showError("取得資料失敗，請重新登入");
        setIsAuth(false);
      }
    })();

    orderModalRef.current = new Modal(modalRef.current, {
      backdrop: "static",
      keyboard: false,
    });

    // Modal 關閉時移除焦點
    modalRef.current.addEventListener("hide.bs.modal", () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
  }, [showError]);

  const getOrderInfo = async (page = 1) => {
    try {
      setIsLoading(true);
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/admin/orders?page=${page}`,
      );
      setOrders(res.data.orders);
      setPagination(res.data.pagination);
    } catch {
      showError("取得資料失敗，請重新登入");
      setIsAuth(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderInfo = async () => {
    try {
      setIsLoading(true);
      const res = await axios.put(
        `${VITE_APP_API_BASE}/api/admin/order/${
          tempOrder.id
        }`,
        {
          data: {
            ...tempOrder,
          },
        },
      );
      setIsLoading(false);
      getOrderInfo();
      showSuccess(res.data.message);
      orderModalRef.current.hide();
    } catch {
      showError("更新失敗");
    } finally {
      setIsLoading(false);
    }
  };

  //處理Pagination page 當前數值
  // Pagination 沒有用 memo，包 useCallback 沒有效果，反而會拿到舊的 getOrderInfo
  const changePage = (e, page) => {
    e.preventDefault();
    getOrderInfo(page);
  };

  const openModal = (singleOrder) => {
    setTempOrder({
      ...singleOrder,
      is_paid: singleOrder.is_paid,
      status: singleOrder.status,
    });

    orderModalRef.current.show();
  };

  const closeModal = () => {
    orderModalRef.current.hide();
  };

  const handleModalInputChange = (e) => {
    const { name, value, checked } = e.target;
    if (["is_paid"].includes(name)) {
      setTempOrder((pre) => ({ ...pre, [name]: checked }));
    } else {
      setTempOrder((pre) => ({ ...pre, [name]: value }));
    }
  };

  return (
    <>
      <AdminOrderModal
        modalRef={modalRef}
        tempOrder={tempOrder}
        handleModalInputChange={handleModalInputChange}
        updateOrderInfo={updateOrderInfo}
        closeModal={closeModal}
      />
      <div className="mb-5">
        <AdminOrderTable orders={orders} openModal={openModal} />
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
};

export default AdminOrders;
