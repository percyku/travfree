import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import axios from "axios";
import Loading from "../components/Loading";
import { checkAuth } from "../slice/authSlice";
import { isAdmin, saveToken } from "../utils/auth";
const { VITE_APP_API_BASE } = import.meta.env;

/** 後台登入頁，只接受有 ADMIN 角色的帳號。前台會員登入在 /signin */
const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [alertMsg, setAlertMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { username: "", password: "" },
  });

  // 已經以管理者登入時直接進後台。一般會員的 token 留著（前台仍是登入狀態），停在這頁讓管理者登入，
  // 否則會與 ProductedRoute 互相導向
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const user = await dispatch(checkAuth()).unwrap();
      setIsLoading(false);
      if (isAdmin(user)) {
        navigate("/admin/products");
      } else if (user) {
        setAlertMsg("目前登入的帳號沒有後台權限，請改用管理者帳號登入");
      }
    })();
  }, [dispatch, navigate]);

  const handleLoginSubmit = async (formData) => {
    try {
      setIsLoading(true);
      const res = await axios.post(
        `${VITE_APP_API_BASE}/admin/signin`,
        formData,
      );
      saveToken(res.data.token, res.data.expired);
      navigate("/admin/products");
    } catch (error) {
      // 顯示後端原因，例如 429 會提示多久後可以再試、403 表示不是管理者
      setAlertMsg(error.response?.data?.message || "登入失敗，請再試一次");
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
        <p className="mt-4">
          <Link to="/">回到前台</Link>
        </p>
        <p className="mt-5 mb-3 text-muted">&copy; 2026 我的練習網站</p>
      </div>
    </>
  );
};

export default Login;
