import { useEffect, useState } from "react";
import axios from "axios";
import { RotatingTriangles } from "react-loader-spinner";
import { useNavigate } from "react-router";

const { VITE_APP_API_BASE, VITE_APP_TOKEN_NAME } = import.meta.env;

const ProductedRoute = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${VITE_APP_TOKEN_NAME}=`))
          ?.split("=")[1];
        axios.defaults.headers.common.Authorization = token;
        if (token !== undefined) {
          const res = await axios.post(`${VITE_APP_API_BASE}/api/user/check`);
          if (res === "") {
            navigate(`/login`);
          } else {
            //getProductInfo();
          }
        } else {
          navigate(`/login`);
        }
      } catch (error) {
        // document.cookie = `${tokenName}; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${VITE_APP_API_COOKIE_PATH}`;
        // 或者使用 max-age 属性
        document.cookie = `${VITE_APP_TOKEN_NAME}=; max-age=0; path=${VITE_APP_API_COOKIE_PATH}`;

        navigate(`/login`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return <RotatingTriangles />;
  }

  return children;
};

export default ProductedRoute;
