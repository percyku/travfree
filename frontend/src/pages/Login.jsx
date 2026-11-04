import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import axios from "axios";
import Loading from "../components/Loading";
const { VITE_APP_API_BASE, VITE_APP_TOKEN_NAME } = import.meta.env;

const Login = () => {
  const navigate = useNavigate();
  const [alertMsg, setAlertMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { username: "percyku19@gmail.com", password: "" },
  });

  useEffect(() => {
    (async () => {
      const tokenName = `${VITE_APP_TOKEN_NAME}=`;
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${VITE_APP_TOKEN_NAME}=`))
        ?.split("=")[1];

      try {
        if (token !== undefined) {
          axios.defaults.headers.common.Authorization = token;
          setIsLoading(true);
          const res = await axios.post(`${VITE_APP_API_BASE}/api/user/check`);

          if (res.data.success === true) {
            navigate("/admin/products");
          } else {
            setAlertMsg(`登入失敗，請再試一次`);
          }
        }
      } catch (error) {
        // document.cookie = `${tokenName}; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${VITE_APP_API_COOKIE_PATH}`;
        // 或者使用 max-age 属性
        document.cookie = `${VITE_APP_TOKEN_NAME}=; max-age=0; path=${VITE_APP_API_COOKIE_PATH}`;
      } finally {
        setIsLoading(false);
      }
    })();
  }, [authData, navigate]);

  const handleLoginSubmit = async (formData) => {
    try {
      setIsLoading(true);
      const res = await axios.post(
        `${VITE_APP_API_BASE}/admin/signin`,
        formData,
      );
      const { token, expired } = res.data;
      setAuthData({ token, expired });
      document.cookie = `${VITE_APP_TOKEN_NAME}=${token};expires=${new Date(
        expired,
      )};`;
    } catch (error) {
      setAlertMsg(`登入失敗 ${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      <Loading isLoading={isLoading} />
      <div className="container login mt-5">
        <div className="row justify-content-center">
          <h1 className="h3 mb-3 font-weight-normal">請先登入</h1>
          <div className="col-8">
            <form
              id="form"
              className="form-signin"
              onSubmit={handleSubmit(handleLoginSubmit)}
            >
              <div className="form-floating mb-3">
                <input
                  id="username"
                  name="username"
                  type="email"
                  className="form-control"
                  placeholder="name@example.com"
                  {...register("username", {
                    required: "請輸入 Email",
                    pattern: {
                      value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                      message: "Email 格式不正確",
                    },
                  })}
                  required
                  autoFocus
                />
                <label htmlFor="username">Email address</label>
                {errors.username && (
                  <p className="text-danger mt-1">{errors.username.message}</p>
                )}
              </div>
              <div className="form-floating">
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-control"
                  placeholder="password"
                  {...register("password", {
                    required: "請輸入密碼",
                    minLength: { value: 6, message: "密碼長度至少需 6 碼" },
                  })}
                  required
                />
                <label htmlFor="password">Password</label>
                {errors.password && (
                  <p className="text-danger mt-1">{errors.password.message}</p>
                )}
              </div>
              <button
                className="btn btn-lg btn-primary w-100 mt-3"
                type="submit"
              >
                登入
              </button>
            </form>
          </div>
        </div>
        {alertMsg !== "" ? (
          <h1 className="h-4 text-danger"> {alertMsg}</h1>
        ) : (
          ""
        )}
        <p className="mt-5 mb-3 text-muted">&copy; 2026 我的練習網站</p>
      </div>
    </>
  );
};

export default Login;
