import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Toaster, toast } from "react-hot-toast";

const NotFound = () => {
  const navigate = useNavigate();
  useEffect(() => {
    toast.error("這是錯誤頁面3秒後轉回首頁");
    const timer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <>
      <Toaster />
      <h1 className="mt-5">404 找不到內容</h1>
    </>
  );
};

export default NotFound;
