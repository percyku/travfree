import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { RotatingTriangles } from "react-loader-spinner";
import { useNavigate } from "react-router";
import { checkAuth } from "../slice/authSlice";
import { isAdmin } from "../utils/auth";

/**
 * 後台路由保護：token 必須有 ADMIN 角色。
 * 一般會員的 token 也會導向登入頁，但不清除，讓會員回前台時仍然是登入狀態。
 */
const ProductedRoute = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await dispatch(checkAuth()).unwrap();
      if (isAdmin(user)) {
        setAllowed(true);
      } else {
        navigate("/login", { replace: true });
      }
    })();
  }, [dispatch, navigate]);

  if (!allowed) {
    return <RotatingTriangles />;
  }

  return children;
};

export default ProductedRoute;
