import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import AdminCouponModal from "./AdminCouponModal";
import AdminCouponTable from "./AdminCouponTable";
import Pagination from "../../components/Pagination";
import Loading from "../../components/Loading";
import useMessage from "../../hooks/useMessage";
import { createModal } from "../../utils/modal";
import { dateInputToSeconds, secondsToDateInput } from "../../utils/coupon";

const { VITE_APP_API_BASE } = import.meta.env;

const EMPTY_COUPON = {
  id: "",
  title: "",
  code: "",
  percent: 80,
  due_date: "",
  is_enabled: true,
};

const AdminCoupons = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useMessage();

  const [isLoading, setIsLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [pagination, setPagination] = useState({
    total_pages: 0,
    current_page: 0,
    has_pre: false,
    has_next: false,
    category: "",
  });
  const [modalType, setModalType] = useState("create");
  const [templateData, setTemplateData] = useState(EMPTY_COUPON);

  const modalRef = useRef(null);
  const couponModalRef = useRef(null);

  const getCoupons = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        const res = await axios.get(
          `${VITE_APP_API_BASE}/api/admin/coupons?page=${page}`,
        );
        setCoupons(res.data.coupons);
        setPagination(res.data.pagination);
      } catch (error) {
        if (error.response?.status === 401) {
          showError("取得資料失敗，請重新登入");
          navigate("/login");
          return;
        }
        showError(error.response?.data?.message ?? "取得優惠券失敗");
      } finally {
        setIsLoading(false);
      }
    },
    [showError, navigate],
  );

  useEffect(() => {
    getCoupons();
  }, [getCoupons]);

  useEffect(() => {
    couponModalRef.current = createModal(modalRef.current, {
      backdrop: "static",
      keyboard: false,
    });
    return () => couponModalRef.current.dispose();
  }, []);

  const openModal = (coupon, type) => {
    setTemplateData(
      type === "create"
        ? EMPTY_COUPON
        : {
            id: coupon.id,
            title: coupon.title,
            code: coupon.code,
            percent: coupon.percent,
            due_date: secondsToDateInput(coupon.due_date),
            is_enabled: coupon.is_enabled === 1,
          },
    );
    setModalType(type);
    couponModalRef.current.show();
  };

  const closeModal = () => {
    couponModalRef.current.hide();
  };

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setTemplateData((prev) => ({
      ...prev,
      [id]: type === "checkbox" ? checked : value,
    }));
  };

  const submitCoupon = async () => {
    // 其他欄位交給後端驗證，錯誤原因會顯示在提示中
    if (!templateData.due_date) {
      showError("請選擇到期日");
      return;
    }
    const data = {
      title: templateData.title.trim(),
      code: templateData.code.trim(),
      percent: Number(templateData.percent),
      due_date: dateInputToSeconds(templateData.due_date),
      is_enabled: templateData.is_enabled ? 1 : 0,
    };
    const isEdit = modalType === "edit";
    try {
      setIsLoading(true);
      const url = isEdit
        ? `${VITE_APP_API_BASE}/api/admin/coupon/${templateData.id}`
        : `${VITE_APP_API_BASE}/api/admin/coupon`;
      const res = isEdit
        ? await axios.put(url, { data })
        : await axios.post(url, { data });
      showSuccess(res.data.message);
      closeModal();
      getCoupons(isEdit ? pagination.current_page || 1 : 1);
    } catch (error) {
      const reason = error.response?.data?.message ?? "";
      showError(`${isEdit ? "更新" : "新增"}失敗! ${reason}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCoupon = async (id) => {
    try {
      setIsLoading(true);
      const res = await axios.delete(
        `${VITE_APP_API_BASE}/api/admin/coupon/${id}`,
      );
      showSuccess(res.data.message);
      closeModal();
      getCoupons(pagination.current_page || 1);
    } catch (error) {
      showError(`刪除失敗! ${error.response?.data?.message ?? ""}`);
    } finally {
      setIsLoading(false);
    }
  };

  const changePage = (e, page) => {
    e.preventDefault();
    getCoupons(page);
  };

  return (
    <>
      <AdminCouponModal
        modalRef={modalRef}
        modalType={modalType}
        templateData={templateData}
        handleInputChange={handleInputChange}
        submitCoupon={submitCoupon}
        deleteCoupon={deleteCoupon}
        closeModal={closeModal}
      />
      <div className="mb-5">
        <AdminCouponTable coupons={coupons} openModal={openModal} />
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

export default AdminCoupons;
